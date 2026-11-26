export enum AdminStatus {
  WAIT = 'WAIT',
  NORMAL = 'NORMAL',
  BLOCK = 'BLOCK',
  DELETE = 'DELETE',
}

/** admin_role.name — 시드(AdminRoleRepositoryService)와 @AdminRole 에 쓰는 값 */
export enum AdminRoleName {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
}
