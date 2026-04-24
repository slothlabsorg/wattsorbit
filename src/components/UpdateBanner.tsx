import { motion, AnimatePresence } from 'framer-motion'
import { useUpdateCheck } from '../hooks/useUpdateCheck'

export function UpdateBanner() {
  const { update, installing } = useUpdateCheck()

  return (
    <AnimatePresence>
      {update && (
        <motion.div
          key="update-banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/20 text-xs">
            <span className="text-amber-300 font-medium">
              WattsOrbit {update.version} is available
            </span>
            <button
              onClick={update.install}
              disabled={installing}
              className="px-2 py-0.5 rounded bg-amber-500 text-black font-semibold hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {installing ? 'Installing…' : 'Update'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
