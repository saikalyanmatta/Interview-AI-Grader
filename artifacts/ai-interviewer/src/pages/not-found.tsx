import React from "react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center px-4">
      <div className="text-center">
        <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl font-display font-bold text-primary">404</span>
        </div>
        <h1 className="text-2xl font-display font-bold mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link href="/">
          <button className="px-6 py-3 rounded-xl font-semibold btn-gradient text-sm">
            Go Home
          </button>
        </Link>
      </div>
    </div>
  );
}
