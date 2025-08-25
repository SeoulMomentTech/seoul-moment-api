// class 나 interface 에서 특정 키를 포함한 optional 객채를 만들 때 사용
export type RequireKey<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;
