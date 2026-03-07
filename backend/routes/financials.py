# Financials Routes - Migrated from server.py
# Handles Invoices, Payments, and Stripe checkout per RFC-002 Section 4.6

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
import os

from .shared import (
    get_database, sanitize_string, validate_uuid, logger
)

# Create router for financials
router = APIRouter(prefix="/financials", tags=["Financials"])

# Get database instance
db = get_database()


# ==================== INVOICES ====================

@router.get("/invoices")
async def get_invoices(
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    job_id: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get all invoices"""
    query = {}
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    if job_id:
        query["job_id"] = job_id
    
    invoices = await db.invoices.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for inv in invoices:
        inv.pop("_id", None)
    return invoices


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str):
    """Get a specific invoice"""
    invoice = await db.invoices.find_one({"$or": [{"id": invoice_id}, {"invoice_number": invoice_id}]})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.pop("_id", None)
    return invoice


@router.post("/invoices")
async def create_invoice(data: dict):
    """Create a new invoice"""
    from models import Invoice, InvoiceLineItem
    
    # Build line items
    line_items = []
    labor_total = parts_total = trip_total = misc_total = 0
    
    for item_data in data.get("line_items", []):
        line_item = InvoiceLineItem(
            line_type=item_data.get("line_type", "parts"),
            description=sanitize_string(item_data.get("description", ""), 200),
            sku=item_data.get("sku"),
            quantity=item_data.get("quantity", 1),
            unit=item_data.get("unit", "each"),
            unit_price=item_data.get("unit_price", 0),
            cost=item_data.get("cost", 0),
        )
        line_item.extended_price = line_item.quantity * line_item.unit_price
        
        if line_item.line_type == "labor":
            labor_total += line_item.extended_price
        elif line_item.line_type == "parts":
            parts_total += line_item.extended_price
        elif line_item.line_type == "trip":
            trip_total += line_item.extended_price
        else:
            misc_total += line_item.extended_price
        
        line_items.append(line_item)
    
    tax_rate = data.get("tax_rate", 0)
    subtotal = labor_total + parts_total + trip_total + misc_total
    tax_amount = subtotal * (tax_rate / 100)
    total = subtotal + tax_amount
    
    # Get job info
    job_number = None
    if data.get("job_id"):
        job = await db.jobs.find_one({"id": data["job_id"]})
        job_number = job["job_number"] if job else None
    
    invoice = Invoice(
        job_id=data.get("job_id"),
        job_number=job_number,
        customer_id=data.get("customer_id"),
        customer_name=sanitize_string(data.get("customer_name", ""), 200),
        customer_email=sanitize_string(data.get("customer_email"), 255) if data.get("customer_email") else None,
        billing_address=sanitize_string(data.get("billing_address"), 500) if data.get("billing_address") else None,
        line_items=[li.dict() for li in line_items],
        labor_total=labor_total,
        parts_total=parts_total,
        trip_total=trip_total,
        misc_total=misc_total,
        subtotal=subtotal,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total=total,
        balance_due=total,
        due_date=data.get("due_date"),
        notes=sanitize_string(data.get("notes"), 2000) if data.get("notes") else None,
    )
    await db.invoices.insert_one(invoice.dict())
    result = invoice.dict()
    return result


@router.put("/invoices/{invoice_id}/status")
async def update_invoice_status(invoice_id: str, data: dict):
    """Update invoice status"""
    invoice = await db.invoices.find_one({"$or": [{"id": invoice_id}, {"invoice_number": invoice_id}]})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    status = data.get("status")
    update_data = {
        "status": status,
        "status_changed_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    if status == "paid":
        update_data["paid_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        update_data["balance_due"] = 0
        update_data["amount_paid"] = invoice["total"]
    
    await db.invoices.update_one({"id": invoice["id"]}, {"$set": update_data})
    return {"message": f"Invoice status updated to {status}"}


@router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, data: dict):
    """Update an invoice"""
    invoice = await db.invoices.find_one({"$or": [{"id": invoice_id}, {"invoice_number": invoice_id}]})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    update_data = {}
    allowed_fields = ["notes", "due_date", "billing_address", "customer_email"]
    
    for k, v in data.items():
        if k in allowed_fields and v is not None:
            if isinstance(v, str):
                update_data[k] = sanitize_string(v, 2000)
            else:
                update_data[k] = v
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.invoices.update_one({"id": invoice["id"]}, {"$set": update_data})
    updated = await db.invoices.find_one({"id": invoice["id"]})
    updated.pop("_id", None)
    return updated


# ==================== PAYMENTS ====================

@router.get("/payments")
async def get_payments(
    invoice_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get all payments"""
    query = {}
    if invoice_id:
        query["invoice_id"] = invoice_id
    if customer_id:
        query["customer_id"] = customer_id
    
    payments = await db.payments.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for p in payments:
        p.pop("_id", None)
    return payments


@router.post("/payments")
async def create_payment(data: dict):
    """Record a payment"""
    from models import Payment
    
    invoice = await db.invoices.find_one({"id": data.get("invoice_id")})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    payment = Payment(
        invoice_id=data.get("invoice_id"),
        invoice_number=invoice.get("invoice_number"),
        customer_id=invoice.get("customer_id"),
        customer_name=invoice.get("customer_name"),
        payment_method=data.get("payment_method"),
        amount=data.get("amount", 0),
        card_last_four=data.get("card_last_four"),
        check_number=data.get("check_number"),
        financing_provider=data.get("financing_provider"),
        notes=sanitize_string(data.get("notes"), 500) if data.get("notes") else None,
    )
    await db.payments.insert_one(payment.dict())
    
    # Update invoice
    new_amount_paid = invoice.get("amount_paid", 0) + data.get("amount", 0)
    new_balance = invoice.get("total", 0) - new_amount_paid
    new_status = "paid" if new_balance <= 0 else "partially_paid"
    
    await db.invoices.update_one(
        {"id": data.get("invoice_id")},
        {"$set": {
            "amount_paid": new_amount_paid,
            "balance_due": max(0, new_balance),
            "status": new_status,
            "status_changed_at": datetime.now(timezone.utc),
            "paid_date": datetime.now(timezone.utc).strftime("%Y-%m-%d") if new_status == "paid" else invoice.get("paid_date"),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    result = payment.dict()
    return result


# ==================== STRIPE CHECKOUT ====================

@router.post("/checkout/create")
async def create_checkout_session(data: dict):
    """Create a Stripe checkout session for an invoice"""
    import stripe
    
    invoice_id = data.get("invoice_id")
    invoice = await db.invoices.find_one({"$or": [{"id": invoice_id}, {"invoice_number": invoice_id}]})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get Stripe key
    stripe_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_key
    
    # Build line items for Stripe
    stripe_line_items = []
    for item in invoice.get("line_items", []):
        stripe_line_items.append({
            "price_data": {
                "currency": "usd",
                "unit_amount": int(item.get("unit_price", 0) * 100),  # Convert to cents
                "product_data": {
                    "name": item.get("description", "Service"),
                },
            },
            "quantity": item.get("quantity", 1),
        })
    
    # Add tax if present
    if invoice.get("tax_amount", 0) > 0:
        stripe_line_items.append({
            "price_data": {
                "currency": "usd",
                "unit_amount": int(invoice["tax_amount"] * 100),
                "product_data": {
                    "name": "Tax",
                },
            },
            "quantity": 1,
        })
    
    # Create checkout session
    success_url = data.get("success_url", f"{os.environ.get('FRONTEND_URL', '')}/invoices/{invoice_id}?payment=success")
    cancel_url = data.get("cancel_url", f"{os.environ.get('FRONTEND_URL', '')}/invoices/{invoice_id}?payment=cancelled")
    
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=stripe_line_items,
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=invoice.get("customer_email"),
            metadata={
                "invoice_id": invoice["id"],
                "invoice_number": invoice.get("invoice_number", ""),
            },
        )
        
        # Store checkout session reference
        await db.invoices.update_one(
            {"id": invoice["id"]},
            {"$set": {
                "stripe_checkout_session_id": session.id,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        return {
            "checkout_url": session.url,
            "session_id": session.id
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")


@router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):
    """Get Stripe checkout session status"""
    import stripe
    
    stripe_key = os.environ.get("STRIPE_SECRET_KEY")
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_key
    
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        # If payment succeeded, update invoice
        if session.payment_status == "paid":
            invoice = await db.invoices.find_one({"stripe_checkout_session_id": session_id})
            if invoice and invoice.get("status") != "paid":
                from models import Payment
                
                # Record payment
                payment = Payment(
                    invoice_id=invoice["id"],
                    invoice_number=invoice.get("invoice_number"),
                    customer_id=invoice.get("customer_id"),
                    customer_name=invoice.get("customer_name"),
                    payment_method="card",
                    amount=invoice.get("balance_due", invoice.get("total", 0)),
                    transaction_id=session.payment_intent,
                    stripe_payment_intent_id=session.payment_intent,
                )
                await db.payments.insert_one(payment.dict())
                
                # Update invoice
                await db.invoices.update_one(
                    {"id": invoice["id"]},
                    {"$set": {
                        "status": "paid",
                        "amount_paid": invoice.get("total", 0),
                        "balance_due": 0,
                        "paid_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                        "status_changed_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc)
                    }}
                )
        
        return {
            "session_id": session.id,
            "payment_status": session.payment_status,
            "amount_total": session.amount_total / 100 if session.amount_total else 0,
            "customer_email": session.customer_email,
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
