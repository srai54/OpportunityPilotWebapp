import { TagInput } from '../../components/TagInput'
import { SKILLS } from '../suggest/catalog'
import { WORK_MODES } from './campaignModel'
import { AUTO_APPROVE_CHOICES, POSTED_CHOICES, type QuickOptions } from './quickOptions'

/**
 * "More options" on New campaign: the choices that narrow a search (tech stack, work mode, experience, how recent, words to avoid) and the
 * one that removes manual review (approve strong matches automatically). Everything is optional.
 */
export function QuickOptionsPanel({ value, onChange, jobs }: Readonly<{ value: QuickOptions; onChange: (next: QuickOptions) => void; jobs: boolean }>) {
  const set = <K extends keyof QuickOptions>(key: K, v: QuickOptions[K]) => onChange({ ...value, [key]: v })
  return (
    <div className="stack-3 quick-options" role="group" aria-label="More options">
      {jobs ? (
        <>
          <TagInput id="qo-stack" label="Tech stack (must have)" values={value.techStack} onChange={(v) => set('techStack', v)} suggestions={SKILLS} placeholder="e.g. TypeScript, AWS"
            hint="A job that does not mention one of these is left out." />
          <TagInput id="qo-nice" label="Nice to have" values={value.niceToHave} onChange={(v) => set('niceToHave', v)} suggestions={SKILLS} placeholder="e.g. GraphQL"
            hint="Scores higher, never excludes. Your profile skills are already counted." />
          <div className="quick-grid">
            <label className="field"><span>Work mode</span>
              <select value={value.workMode} onChange={(e) => set('workMode', e.target.value as QuickOptions['workMode'])}>
                <option value="">Any</option>
                {WORK_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select></label>
            <label className="field"><span>Years of experience</span>
              <input type="number" inputMode="numeric" min={0} max={60} value={value.years} onChange={(e) => set('years', e.target.value)} placeholder="e.g. 5" /></label>
            <label className="field"><span>Posted</span>
              <select value={value.postedDays} onChange={(e) => set('postedDays', e.target.value)}>
                {POSTED_CHOICES.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
              </select></label>
          </div>
          <label className="check"><input type="checkbox" checked={value.noAgencies} onChange={(e) => set('noAgencies', e.target.checked)} /> Leave out staffing agencies</label>
        </>
      ) : (
        <>
          <TagInput id="qo-industries" label="Industries" values={value.industries} onChange={(v) => set('industries', v)} placeholder="e.g. Logistics, Retail" />
          <TagInput id="qo-signals" label="Buying signals" values={value.signals} onChange={(v) => set('signals', v)} placeholder="e.g. hiring for payroll" />
        </>
      )}
      <TagInput id="qo-exclude" label="Leave out words" values={value.exclude} onChange={(v) => set('exclude', v)} placeholder="e.g. intern, unpaid" />
      {jobs && (
        <label className="field"><span>Approval</span>
          <select value={value.autoApprove} onChange={(e) => set('autoApprove', Number(e.target.value))}>
            {AUTO_APPROVE_CHOICES.map((n) => <option key={n} value={n}>{n === 0 ? 'I approve each job myself' : `Approve matches scoring ${n}+ automatically`}</option>)}
          </select>
          <span className="hint">Automatic approval only marks a job approved. Jobs on LinkedIn, Naukri and Instahyre are then applied for by your agent; for other sites you open the apply queue.</span></label>
      )}
    </div>
  )
}
