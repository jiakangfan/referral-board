// 申请内推页面：网址 /ask，必须登录
import { useState } from 'react'
import { useQuery } from 'deepspace'
import { Button, Input, Label, Textarea } from '@/components/ui'
import { callAction } from '@/lib/action'
import { useNavigate } from '@/router'
import type { Referrer } from '@/types'

export default function AskPage() {
  const navigate = useNavigate()

  // 公司下拉框：从内推人表里取，同一个域名只出现一次
  const { records: referrers } = useQuery<Referrer>('referrers')
  const companies = [...new Map(referrers.map((r) => [r.data.domain, r.data.company])).entries()]

  // 表单里填的内容
  const [domain, setDomain] = useState('')
  const [jobId, setJobId] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // 点"Submit"：交给服务器检查并保存，成功后回到首页
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await callAction('submitRequest', { domain, jobId, jobTitle, jobUrl, resumeText, jobDescription })
    setBusy(false)
    if (res.success) navigate('/home')
    else setError(res.error)
  }

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl space-y-8 px-6 py-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Ask for a referral</h1>
          <p className="text-sm text-muted-foreground">
            Everyone can see the company, role and status. Only the referrer who claims your request
            can read your resume.
          </p>
        </header>

        {companies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No verified referrers yet, so there is no company to ask.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <select
                id="company"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="" disabled>Choose a company</option>
                {companies.map(([d, name]) => (
                  <option key={d} value={d}>{name} (@{d})</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="jobId">Job ID</Label>
                <Input id="jobId" value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="JR2023491" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job title</Label>
                <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Hardware Intern" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobUrl">Job posting link</Label>
              <Input id="jobUrl" type="url" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resume">Resume (paste the text)</Label>
              <Textarea id="resume" rows={8} value={resumeText} onChange={(e) => setResumeText(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jd">Job description (optional, helps the referrer write a note)</Label>
              <Textarea id="jd" rows={6} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" loading={busy}>Submit request</Button>
          </form>
        )}
      </div>
    </div>
  )
}
