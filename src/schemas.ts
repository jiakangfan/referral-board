/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { referrersSchema } from './schemas/referrers-schema'
import { requestsSchema, requestPrivateSchema } from './schemas/requests-schema'
import { emailCodesSchema } from './schemas/email-codes-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  referrersSchema,
  requestsSchema,
  requestPrivateSchema,
  emailCodesSchema,
]
