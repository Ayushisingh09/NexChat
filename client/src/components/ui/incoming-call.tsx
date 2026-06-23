import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface IncomingCallProps {
  callerName: string;
  callerInfo?: string;
  statusText: string;
  avatarUrl?: string;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
  className?: string;
  isOpen?: boolean;
}

const IncomingCall = React.forwardRef<HTMLDivElement, IncomingCallProps>(
  (
    {
      className,
      callerName,
      callerInfo,
      statusText,
      avatarUrl,
      onAccept,
      onDecline,
      onClose,
      isOpen = false,
      ...props
    },
    ref
  ) => {
    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('');
    };

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={cn(
              'fixed bottom-5 right-5 z-50 w-full max-w-sm rounded-2xl border border-white/10 bg-[#1f2c34]/95 p-6 text-white shadow-2xl backdrop-blur-lg',
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="incoming-call-name"
            {...props}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 h-7 w-7 rounded-full hover:bg-white/10"
              onClick={onClose}
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="relative rounded-full p-1.5 bg-[#1f2c34]"
              >
                <Avatar className="h-24 w-24 border-2 border-emerald-500/20">
                  <AvatarImage src={avatarUrl} alt={callerName} />
                  <AvatarFallback className="text-3xl bg-[#2a3a45]">
                    {getInitials(callerName)}
                  </AvatarFallback>
                </Avatar>
              </motion.div>

              <div>
                <h2 id="incoming-call-name" className="text-2xl font-bold tracking-tight">
                  {callerName}
                  {callerInfo && <span className="text-zinc-400 font-normal"> ({callerInfo})</span>}
                </h2>
                <p className="text-zinc-400">{statusText}</p>
              </div>

              <div className="grid w-full grid-cols-2 gap-4 pt-4">
                <Button
                  size="lg"
                  className="w-full bg-emerald-500 text-white hover:bg-emerald-600"
                  onClick={onAccept}
                >
                  <Phone className="mr-2 h-5 w-5" />
                  Accept
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  className="w-full"
                  onClick={onDecline}
                >
                  <PhoneOff className="mr-2 h-5 w-5" />
                  Decline
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
IncomingCall.displayName = 'IncomingCall';

export { IncomingCall };
