import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";

const planFeatures = [
  "Unlimited conversations",
  "Priority support",
  "Early access to new features",
];

export function GlassAccountSettingsCard() {
  const shouldReduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const [autoRenew, setAutoRenew] = useState(true);
  const [productUpdates, setProductUpdates] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        ease: shouldReduceMotion ? "linear" : [0.16, 1, 0.3, 1],
      }}
      className="group w-full max-w-4xl rounded-3xl overflow-hidden border border-white/10 bg-[#1f2c34]/85 p-8 sm:p-12 relative"
      aria-labelledby="glass-account-title"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 -z-10"
      />
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.28em] text-zinc-400">
            Account Settings
          </div>
          <h1
            id="glass-account-title"
            className="mt-3 text-2xl font-semibold text-white sm:text-3xl"
          >
            Manage your account settings and preferences
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Update personal details, control notifications, and manage your
            current plan in one place.
          </p>
        </div>
        <Badge className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-emerald-400 transition-colors duration-300 hover:border-emerald-500/50 hover:bg-emerald-500/20">
          Pro
        </Badge>
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_3fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#1a2332]/45 p-6">
            <h2 className="text-sm font-medium text-white">Security</h2>
            <p className="mb-4 text-xs text-zinc-400">
              Control how you access your account.
            </p>
            <div className="space-y-4 text-sm text-zinc-400">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-white">
                  Email
                </Label>
                <p>{user?.email || 'Not set'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium text-white">
                  Two-factor authentication
                </Label>
                <Button
                  variant="outline"
                  className="rounded-full border-white/10 px-4 py-2 text-xs hover:border-emerald-500/30 hover:text-emerald-400"
                >
                  Manage 2FA
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#1a2332]/45 p-6">
            <h2 className="text-sm font-medium text-white">
              Notifications
            </h2>
            <p className="mb-4 text-xs text-zinc-400">
              Decide what updates reach your inbox.
            </p>
            <div className="space-y-4 text-sm text-zinc-400">
              <label className="flex items-center justify-between gap-3">
                Auto-renew subscription
                <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
              </label>
              <label className="flex items-center justify-between gap-3">
                Product update emails
                <Switch
                  checked={productUpdates}
                  onCheckedChange={setProductUpdates}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#1a2332]/45 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium text-white">
                  Current plan
                </h2>
                <p className="text-xs text-zinc-400">
                  NexChat Pro - billed yearly
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-semibold text-white">
                  Free
                </span>
                <p className="text-xs text-zinc-400">
                  forever
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-zinc-400">
              {planFeatures.map((feature) => (
                <p key={feature} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-emerald-500/10 text-emerald-400">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                  {feature}
                </p>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-full border-white/10 bg-white/5 px-6 py-3 text-sm text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30"
              >
                Cancel subscription
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-full bg-emerald-500 px-6 py-3 text-white shadow-[0_20px_60px_-30px_rgba(16,185,129,0.75)] transition-transform duration-300 hover:-translate-y-1 hover:bg-emerald-600"
              >
                Manage plan
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#1a2332]/45 p-6">
            <h2 className="text-sm font-medium text-white">Billing</h2>
            <p className="mb-4 text-xs text-zinc-400">
              Download invoices or update payment details.
            </p>
            <div className="flex flex-col gap-3 text-sm text-zinc-400 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1 rounded-full border-white/10 px-6 py-3 text-sm text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30"
              >
                View invoices
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-full border-white/10 px-6 py-3 text-sm text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30"
              >
                Update payment method
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
