export enum PlanSchedulePayType {
  CREDIT = 'CREDIT',
  CASH = 'CASH',
  OTHER = 'OTHER',
}

export enum PlanScheduleSortColumn {
  CREATE = 'createDate',
  PAY_TYPE = 'payType',
  AMOUNT = 'amount',
  START_DATE = 'startDate',
}

export enum PlanScheduleStatus {
  NORMAL = 'NORMAL',
  DELETE = 'DELETE',
}
