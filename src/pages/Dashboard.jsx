import AppLayout from '../components/AppLayout'
import { useRecruiter } from '../hooks/useRecruiter'
import { useStats } from '../hooks/useStats'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getFormattedDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function StatCard({ label, value, loading }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{loading ? '—' : value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

export default function Dashboard() {
  const { recruiter, loading: recruiterLoading } = useRecruiter()
  const { stats, loading: statsLoading } = useStats(recruiter?.id)

  const firstName = recruiter?.full_name?.split(' ')[0] ?? ''

  return (
    <AppLayout>
      <section className="brief-greeting">
        <h1 className="brief-headline">
          {getGreeting()}{!recruiterLoading && firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="brief-date">{getFormattedDate()}</p>
      </section>

      <section className="brief-card">
        <div className="brief-card-inner">
          <p className="brief-card-eyebrow">Morning Brief</p>
          <p className="brief-card-body">
            Your overnight brief will appear here once Primer has been running.
          </p>
        </div>
      </section>

      <section className="stats-row">
        <StatCard label="Active Roles" value={stats?.activeRoles} loading={statsLoading} />
        <StatCard label="Candidates in Pipeline" value={stats?.candidatesInPipeline} loading={statsLoading} />
        <StatCard label="Messages to Review" value={stats?.messagesToReview} loading={statsLoading} />
      </section>
    </AppLayout>
  )
}
