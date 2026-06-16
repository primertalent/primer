import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Derive a display name from an email address when no name is set yet
function nameFromEmail(email) {
  const local = email.split('@')[0]
  return local
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function useRecruiter() {
  const { user } = useAuth()
  const [recruiter, setRecruiter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return

    async function fetchOrCreate() {
      // Try to fetch existing recruiter record
      const { data, error: fetchError } = await supabase
        .from('recruiters')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows found — anything else is a real error
        setError(fetchError)
        setLoading(false)
        return
      }

      let row = data

      if (!row) {
        // No record yet — create one. full_name will be updated when they set up their profile.
        const { data: created, error: insertError } = await supabase
          .from('recruiters')
          .insert({
            user_id: user.id,
            email: user.email,
            full_name: nameFromEmail(user.email),
          })
          .select()
          .single()

        if (insertError) {
          setError(insertError)
          setLoading(false)
          return
        }

        row = created
      }

      // Auto-detect timezone from browser and self-correct if the stored value is still
      // the system default (timezone_confirmed = false). Correct in-memory first so this
      // session is right regardless of whether the persist succeeds. A failed write leaves
      // the DB as-is (still unconfirmed), so the correction retries on next login.
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!row.timezone_confirmed && browserTz && browserTz !== row.timezone) {
        row = { ...row, timezone: browserTz }
        try {
          await supabase
            .from('recruiters')
            .update({ timezone: browserTz })
            .eq('id', row.id)
        } catch (tzErr) {
          console.warn('[useRecruiter] timezone auto-correct write failed:', tzErr?.message)
        }
      }

      setRecruiter(row)
      setLoading(false)
    }

    fetchOrCreate()
  }, [user])

  return { recruiter, loading, error }
}
