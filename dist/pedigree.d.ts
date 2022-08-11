export declare type DefiniteIdentifier = string | number;
export declare type Identifier = DefiniteIdentifier | null;
export interface PedigreeEntry {
    family: DefiniteIdentifier;
    sample: DefiniteIdentifier;
    mother?: Identifier;
    father?: Identifier;
    sex: -1 | 0 | "0" | null | 1 | "1" | "Male" | 2 | "2" | "Female";
}
export declare type PedigreeValidationOptionValue = "ignore" | "error" | "warning";
export interface PedigreeValidationOptions {
    /**
     * Require there to be at least one entry in the pedigree?
     * Default: "ignore" => empty is permitted.
     */
    empty: PedigreeValidationOptionValue;
    /**
     * The pedigree contains duplicate definitions for an individual.
     */
    duplicates: PedigreeValidationOptionValue;
    /**
     * The sex of an individual is inconsistent with their occurrence as a mother or father.
     */
    inconsistentSex: PedigreeValidationOptionValue;
    /**
     * Are multiple families permitted.
     * Default: "error" => multiple families are not permitted.
     */
    multipleFamilies: PedigreeValidationOptionValue;
    /**
     * Are individuals allowed to be in more than one family.
     * Default: "error" => individuals may only belong to 1 family.
     */
    oneFamily: PedigreeValidationOptionValue;
    /**
     * Must families be fully connected?
     * Default: "error" => all individuals in family must be connected
     */
    fullyConnected: PedigreeValidationOptionValue;
    /**
     * How to handle cycles in pedigree.
     * Default: "error" => it doesn't make sense to have cycles in pedigree.
     */
    cycles: PedigreeValidationOptionValue;
}
export declare const strict: PedigreeValidationOptions;
export declare const permissive: PedigreeValidationOptions;
export interface PedigreeValidationResult {
    ok: boolean;
    reasons: string[];
    problematic: Set<DefiniteIdentifier>;
    whys: {
        [who: DefiniteIdentifier]: string[];
    };
}
export declare function validatePedigree(ped: PedigreeEntry[], options?: PedigreeValidationOptions): PedigreeValidationResult;
