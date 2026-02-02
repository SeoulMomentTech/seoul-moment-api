import { PlanCategoryType } from '../enum/plan-category.enum';

export class PlanAllCategoryDto {
  id: number;
  name: string;
  type: PlanCategoryType;

  static from(
    id: number,
    name: string,
    type: PlanCategoryType,
  ): PlanAllCategoryDto {
    return {
      id,
      name,
      type,
    };
  }
}
