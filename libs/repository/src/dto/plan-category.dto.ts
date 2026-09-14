import { PlanCategoryType } from '../enum/plan-category.enum';

export class PlanAllCategoryDto {
  id: number;
  name: string;
  type: PlanCategoryType;
  /**
   * 이 카테고리를 만든 사람의 이름. **방에서 공유된 것(`ROOM`)에만 있다** —
   * 시스템 기본 카테고리는 만든 사람이 없고, 내가 만든 것(`USER`)은 화면이
   * 이미 "my" 로 말하고 있어서 이름을 다시 낼 자리가 아니다.
   */
  createdByName?: string;

  static from(
    id: number,
    name: string,
    type: PlanCategoryType,
    createdByName?: string,
  ): PlanAllCategoryDto {
    return {
      id,
      name,
      type,
      createdByName,
    };
  }
}
