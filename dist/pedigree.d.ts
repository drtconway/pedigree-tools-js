export declare type DefiniteIdentifier = string | number;
export declare type Identifier = DefiniteIdentifier | null;
export interface PedigreeEntry {
    family: DefiniteIdentifier;
    sample: DefiniteIdentifier;
    mother?: Identifier;
    father?: Identifier;
    sex: -1 | 0 | "0" | null | 1 | "1" | "Male" | 2 | "2" | "Female";
}
export interface PedigreeValidationOptions {
    strict?: boolean;
}
export interface PedigreeValidationResult {
    ok: boolean;
    reasons: string[];
    problematic: Set<DefiniteIdentifier>;
    whys: {
        [who: DefiniteIdentifier]: string[];
    };
}
export declare function validatePedigree(ped: PedigreeEntry[], options?: PedigreeValidationOptions): PedigreeValidationResult;
