export type Id = string | number;
export type ApiValue = string | number | boolean | null | undefined | ApiValue[] | {
    [key: string]: ApiValue;
};
