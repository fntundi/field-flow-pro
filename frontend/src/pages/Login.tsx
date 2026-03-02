import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wind, Mail, Lock, User, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";

interface AuthProps {
  onLogin?: (user: any, token: string) => void;
}

export default function Login({ onLogin }: AuthProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("login");
  
  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      localStorage.setItem("auth_token", data.access_token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      toast.success(`Welcome back, ${data.user.name}!`);
      if (onLogin) {
        onLogin(data.user, data.access_token);
      }
      navigate("/");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Invalid credentials");
    },
  });
  
  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      localStorage.setItem("auth_token", data.access_token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      toast.success(`Welcome, ${data.user.name}!`);
      if (onLogin) {
        onLogin(data.user, data.access_token);
      }
      navigate("/");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Registration failed");
    },
  });
  
  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    loginMutation.mutate({
      email: formData.get("login_email") as string,
      password: formData.get("login_password") as string,
    });
  };
  
  const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get("register_password") as string;
    const confirmPassword = formData.get("confirm_password") as string;
    
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    
    registerMutation.mutate({
      email: formData.get("register_email") as string,
      password: password,
      name: formData.get("register_name") as string,
      role: formData.get("register_role") as string || "technician",
    });
  };
  
  const handleDemoLogin = (role: string) => {
    // Demo login - creates or logs in as demo user
    const demoUsers: { [key: string]: { email: string; password: string; name: string } } = {
      admin: { email: "demo-admin@breezeflow.com", password: "demo123", name: "Demo Admin" },
      dispatcher: { email: "demo-dispatcher@breezeflow.com", password: "demo123", name: "Demo Dispatcher" },
      technician: { email: "demo-tech@breezeflow.com", password: "demo123", name: "Demo Technician" },
      sales: { email: "demo-sales@breezeflow.com", password: "demo123", name: "Demo Sales" },
    };
    
    const demo = demoUsers[role];
    if (demo) {
      // Try to login first, if fails, register
      loginMutation.mutate({ email: demo.email, password: demo.password }, {
        onError: () => {
          registerMutation.mutate({ ...demo, role });
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="p-2 bg-accent/20 rounded-xl">
              <Wind className="w-8 h-8 text-accent" />
            </div>
            <span className="text-2xl font-bold">BreezeFlow</span>
          </div>
          <p className="text-muted-foreground text-sm">HVAC Field Service Management</p>
        </div>
        
        <Card className="border-border">
          <CardHeader className="text-center pb-2">
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in or create an account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              
              {/* Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login_email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login_email"
                        name="login_email"
                        type="email"
                        placeholder="you@company.com"
                        className="pl-10"
                        required
                        data-testid="login-email-input"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="login_password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login_password"
                        name="login_password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        required
                        data-testid="login-password-input"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loginMutation.isPending}
                    data-testid="login-submit-btn"
                  >
                    {loginMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...</>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              {/* Register Tab */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label htmlFor="register_name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="register_name"
                        name="register_name"
                        placeholder="John Smith"
                        className="pl-10"
                        required
                        data-testid="register-name-input"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="register_email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="register_email"
                        name="register_email"
                        type="email"
                        placeholder="you@company.com"
                        className="pl-10"
                        required
                        data-testid="register-email-input"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="register_role">Role</Label>
                    <Select name="register_role" defaultValue="technician">
                      <SelectTrigger data-testid="register-role-select">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technician">Technician</SelectItem>
                        <SelectItem value="dispatcher">Dispatcher</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="register_password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="register_password"
                        name="register_password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        required
                        minLength={6}
                        data-testid="register-password-input"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="confirm_password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="confirm_password"
                        name="confirm_password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        required
                        minLength={6}
                        data-testid="register-confirm-password-input"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={registerMutation.isPending}
                    data-testid="register-submit-btn"
                  >
                    {registerMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating account...</>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            
            {/* Google OAuth Section */}
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full mt-4 gap-2"
                onClick={() => {
                  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
                  const redirectUrl = window.location.origin + '/';
                  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
                }}
                disabled={loginMutation.isPending || registerMutation.isPending}
                data-testid="google-login-btn"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>
            </div>
            
            {/* Demo Login Section */}
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-center text-sm text-muted-foreground mb-3">Or try a demo account:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleDemoLogin("admin")}
                  disabled={loginMutation.isPending || registerMutation.isPending}
                  data-testid="demo-admin-btn"
                >
                  Admin
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleDemoLogin("dispatcher")}
                  disabled={loginMutation.isPending || registerMutation.isPending}
                  data-testid="demo-dispatcher-btn"
                >
                  Dispatcher
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleDemoLogin("technician")}
                  disabled={loginMutation.isPending || registerMutation.isPending}
                  data-testid="demo-technician-btn"
                >
                  Technician
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleDemoLogin("sales")}
                  disabled={loginMutation.isPending || registerMutation.isPending}
                  data-testid="demo-sales-btn"
                >
                  Sales
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground mt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </motion.div>
    </div>
  );
}
