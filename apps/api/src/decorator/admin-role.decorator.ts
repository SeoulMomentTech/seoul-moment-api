import { SetMetadata } from '@nestjs/common';

export const ADMIN_ROLE_KEY = 'admin_role';

export const AdminRole = (role: string) => SetMetadata(ADMIN_ROLE_KEY, role);
