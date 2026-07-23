/** Seed quotation templates for CRM API mode.
 * Only the two VF ISO product templates — matches frontend DEFAULT_QUOTATION_TEMPLATES.
 */
export interface QuotationTemplateSeedRow {
    code: string;
    templateName: string;
    productFamily: string;
    version: number;
    defaultTerms: string;
    defaultWarranty: string;
    defaultExclusions: string;
    sections: Array<Record<string, unknown>>;
}
export declare const QUOTATION_TEMPLATE_SEED_ROWS: QuotationTemplateSeedRow[];
/** Only these catalog codes stay active — seed + live cleanup soft-delete everything else. */
export declare const QUOTATION_TEMPLATE_KEEP_CODES: string[];
export declare const VF_WORD_PRINT_LAYOUT_SEED: {
    readonly pageSize: "A4";
    readonly marginMm: 18;
    readonly fontScale: 1;
    readonly headerStyle: "minimal";
    readonly showLogo: false;
    readonly showCompanyHeader: false;
    readonly showCustomerBlock: false;
    readonly showPageFooter: true;
    readonly showSignatureBlock: true;
    readonly pageBreakBefore: readonly ["price_table"];
    readonly printSkin: "vf_word";
};
//# sourceMappingURL=quotationTemplateSeedData.d.ts.map