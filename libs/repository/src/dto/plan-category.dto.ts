import { PlanCategoryType } from '../enum/plan-category.enum';

export class PlanAllCategoryDto {
  id: number;
  name: string;
  type: PlanCategoryType;
  color: string;

  static from(
    id: number,
    name: string,
    type: PlanCategoryType,
    color: string = '#8E9DAB',
  ): PlanAllCategoryDto {
    return {
      id,
      name,
      type,
      color,
    };
  }
}
