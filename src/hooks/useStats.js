import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useStats(recruiterId) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!recruiterId) return

    async function fetchStats() {
      const [rolesResult, pipelineResult, messagesResult] = await Promise.all([
        supabase
          .from('roles')
          .select('*', { count: 'exact', head: true })
          .eq('recruiter_id', recruiterId)
          .eq('status', 'open'),

        supabase
          .from('pipeline')
          .select('*', { count: 'exact', head: true })
          .eq('recruiter_id', recruiterId)
          .eq('status', 'active'),

        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('recruiter_id', recruiterId)
          .in('status', ['drafted', 'held_for_review']),
      ])

      const err = rolesResult.error || pipelineResult.error || messagesResult.error
      if (err) {
        setError(err)
      } else {
        setStats({
          activeRoles: rolesResult.count ?? 0,
          candidatesInPipeline: pipelineResult.count ?? 0,
          messagesToReview: messagesResult.count ?? 0,
        })
      }

      setLoading(false)
    }

    fetchStats()
  }, [recruiterId])

  return { stats, loading, error }
}
