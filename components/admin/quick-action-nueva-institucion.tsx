'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';

import { NuevaInstitucionModal } from './nueva-institucion-modal';

export function QuickActionNuevaInstitucion() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-end">
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        className="squircle group inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold tracking-tight text-cream-pure shadow-card-subtle ring-1 ring-ink transition-shadow hover:bg-[var(--ink-raised)] hover:shadow-card-elevated"
      >
        <Plus
          className="size-4 transition-transform group-hover:rotate-90"
          strokeWidth={2}
        />
        Nueva institución
      </motion.button>
      <NuevaInstitucionModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
