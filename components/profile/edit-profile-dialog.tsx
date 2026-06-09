'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2, Pencil, X } from 'lucide-react'
import { useUpdateProfile } from '@/hooks/useUserProfile'
import type { UserSummary } from '@/hooks/useUsers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface EditProfileDialogProps {
  user: UserSummary & { orcidId?: string; publicationsUrl?: string; isPublic?: boolean }
}

export function EditProfileDialog({ user }: EditProfileDialogProps) {
  const [open, setOpen]         = useState(false)
  const [interests, setInterests] = useState<string[]>(user.researchInterests ?? [])
  const [interestInput, setInterestInput] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const { mutateAsync, isPending } = useUpdateProfile()

  const { register, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: {
      bio:             user.bio ?? '',
      department:      user.department ?? '',
      position:        user.position ?? '',
      orcidId:         user.orcidId ?? '',
      publicationsUrl: user.publicationsUrl ?? '',
    },
  })

  function addInterest() {
    const val = interestInput.trim()
    if (val && !interests.includes(val) && interests.length < 10) {
      setInterests([...interests, val])
      setInterestInput('')
    }
  }

  function removeInterest(i: string) {
    setInterests(interests.filter((x) => x !== i))
  }

  async function onSubmit(data: any) {
    setError(null)
    try {
      await mutateAsync({ ...data, researchInterests: interests })
      setOpen(false)
    } catch (err: any) {
      setError(err.message ?? 'Failed to update profile')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 rounded-xl">
          <Pencil className="h-4 w-4" />
          Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Edit your profile</DialogTitle>
          <DialogDescription>
            Update your academic information and research interests.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {error && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              {...register('bio')}
              placeholder="Tell other researchers about your work…"
              rows={3}
              className="rounded-xl resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input id="department" {...register('department')} placeholder="e.g. School of Engineering" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="position">Position</Label>
              <Input id="position" {...register('position')} placeholder="e.g. PhD Student" className="rounded-xl" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Research interests</Label>
            <div className="flex gap-2">
              <Input
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest() } }}
                placeholder="e.g. Machine Learning"
                className="rounded-xl"
              />
              <Button type="button" variant="outline" className="rounded-xl shrink-0" onClick={addInterest}>
                Add
              </Button>
            </div>
            {interests.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {interests.map((i) => (
                  <Badge key={i} variant="secondary" className="rounded-full gap-1 pr-1">
                    {i}
                    <button type="button" onClick={() => removeInterest(i)} className="rounded-full hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="orcidId">ORCID iD <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="orcidId" {...register('orcidId')} placeholder="0000-0000-0000-0000" className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="publicationsUrl">Publications URL <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="publicationsUrl" {...register('publicationsUrl')} placeholder="https://scholar.google.com/…" className="rounded-xl" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl" disabled={isPending}>
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}