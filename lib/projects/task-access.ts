import mongoose from 'mongoose'
import Project from '@/lib/db/models/Project'
import Task from '@/lib/db/models/Task'
import { canEditProject, isMember } from '@/lib/projects/membership'

export type TaskAccess =
  | {
      ok: true
      project: { _id: mongoose.Types.ObjectId; title: string; members: { userId: mongoose.Types.ObjectId; role: string }[] }
      task: {
        _id: mongoose.Types.ObjectId
        title: string
        createdBy: mongoose.Types.ObjectId
        assigneeId?: mongoose.Types.ObjectId
      }
      /** PI or co-PI: may moderate other people's comments. */
      canModerate: boolean
    }
  | { ok: false; status: 400 | 403 | 404; error: string }

/**
 * The task, but only when it belongs to this project and the caller is one of
 * its members.
 *
 * Checking membership of the project alone is not enough: the task has to be
 * looked up *within* it, or a member of one project could reach another
 * project's tasks by pairing their own project id with a guessed task id.
 */
export async function taskForMember(
  projectId: string,
  taskId: string,
  userId: string
): Promise<TaskAccess> {
  if (!mongoose.isValidObjectId(projectId) || !mongoose.isValidObjectId(taskId)) {
    return { ok: false, status: 400, error: 'Invalid ID' }
  }

  const project = await Project.findById(projectId).select('title members').lean()
  if (!project) return { ok: false, status: 404, error: 'Project not found' }
  if (!isMember(project, userId)) return { ok: false, status: 403, error: 'Forbidden' }

  const task = await Task.findOne({ _id: taskId, projectId })
    .select('title createdBy assigneeId')
    .lean()
  if (!task) return { ok: false, status: 404, error: 'Task not found' }

  return {
    ok: true,
    project: project as never,
    task: task as never,
    canModerate: canEditProject(project, userId),
  }
}
