import { DefiniteIdentifier, PedigreeEntry, validatePedigree } from "../src/pedigree";

import * as mocha from "mocha";
import * as chai from "chai";

const expect = chai.expect;

describe("Validate proband only pedigrees.", () => {
  it("proband only (good)", () => {
    const ped: PedigreeEntry[] = [{ family: "FAM01", sample: "SAM001", sex: "Male" }];
    const res = validatePedigree(ped);
    expect(res.ok).to.be.true;
    expect(res.reasons.length).to.eql(0);
    expect(res.problematic.size).to.eql(0);
    expect(Object.keys(res.whys).length).to.eql(0);
  });
  it("2 probands only (unconnected)", () => {
    const ped: PedigreeEntry[] = [
      { family: "FAM01", sample: "SAM001", sex: "Male" },
      { family: "FAM01", sample: "SAM002", sex: "Female" },
    ];
    const res = validatePedigree(ped);
    expect(res.ok).to.be.true;
    expect(res.reasons.length).to.eql(1);
    expect(res.reasons[0]).to.eql("Not all samples are connected.");
    expect(res.problematic.size).to.eql(1);
    expect(res.problematic.has("SAM002")).to.be.true;
    expect("SAM002" in res.whys).to.be.true;
    expect(res.whys["SAM002"][0]).to.eql("Sample is not connected.");
  });
  it("2 probands only (unconnected, strict)", () => {
    const ped: PedigreeEntry[] = [
      { family: "FAM01", sample: "SAM001", sex: "Male" },
      { family: "FAM01", sample: "SAM002", sex: "Female" },
    ];
    const res = validatePedigree(ped, { strict: true });
    expect(res.ok).to.eql(false);
    expect(res.reasons.length).to.eql(1);
    expect(res.reasons[0]).to.eql("Not all samples are connected.");
    expect(res.problematic.size).to.eql(1);
    expect(res.problematic.has("SAM002")).to.be.true;
    expect("SAM002" in res.whys).to.be.true;
    expect(res.whys["SAM002"][0]).to.eql("Sample is not connected.");
  });
});

describe("Validate simple trio pedigrees.", () => {
  it("simple trio with implied parents (good)", () => {
    const ped: PedigreeEntry[] = [
      {
        family: "FAM01",
        sample: "SAM001",
        mother: "SAM002",
        father: "SAM003",
        sex: "Male",
      },
    ];
    const res = validatePedigree(ped);
    expect(res.ok).to.be.true;
    expect(res.reasons.length).to.eql(0);
    expect(res.problematic.size).to.eql(0);
    expect(Object.keys(res.whys).length).to.eql(0);
  });
  it("simple trio with parents (good)", () => {
    const ped: PedigreeEntry[] = [
      {
        family: "FAM01",
        sample: "SAM001",
        mother: "SAM002",
        father: "SAM003",
        sex: "1",
      },
      { family: "FAM01", sample: "SAM002", sex: "2" },
      { family: "FAM01", sample: "SAM003", sex: "1" },
    ];
    const res = validatePedigree(ped);
    expect(res.ok).to.be.true;
    expect(res.reasons.length).to.eql(0);
    expect(res.problematic.size).to.eql(0);
    expect(Object.keys(res.whys).length).to.eql(0);
  });
  it("simple trio with parents (bad)", () => {
    const ped: PedigreeEntry[] = [
      {
        family: "FAM01",
        sample: "SAM001",
        mother: "SAM002",
        father: "SAM003",
        sex: "1",
      },
      { family: "FAM01", sample: "SAM002", sex: "2" },
      { family: "FAM01", sample: "SAM003", mother: "SAM001", sex: "1" },
    ];
    const res = validatePedigree(ped);
    expect(res.ok).to.eql(false);
    expect(res.reasons.length).to.eql(2);
    expect(res.reasons[0]).to.eql("At least one sample has inconsistent sex.");
    expect(res.reasons[1]).to.eql("There was at least one instance of someone being their own ancestor.");

    expect(res.problematic.size).to.eql(2);
    expect(res.problematic.has("SAM001")).to.be.true;
    expect(res.problematic.has("SAM003")).to.be.true;

    expect(Object.keys(res.whys).length).to.eql(2);
    expect("SAM001" in res.whys).to.be.true;
    expect(res.whys["SAM001"][0]).to.eql("Sample is a mother, but is assigned male.");
    expect(res.whys["SAM001"][1]).to.eql("Sample is an ancestor of itself.");
    expect("SAM003" in res.whys).to.be.true;
    expect(res.whys["SAM003"][0]).to.eql("Sample is an ancestor of itself.");
  });
});

describe("assorted corner cases", () => {
  it("empty pedigree", () => {
    const ped: PedigreeEntry[] = [];
    const res = validatePedigree(ped);
    expect(res).to.eql({
      ok: false,
      reasons: ["An empty pedigree is not valid."],
      problematic: new Set<DefiniteIdentifier>(),
      whys: {},
    });
  });
  it("singleton with unknown sex", () => {
    const ped: PedigreeEntry[] = [
      {
        family: "FAM01",
        sample: "SAM001",
        mother: "SAM002",
        father: "SAM003",
        sex: null,
      },
    ];
    const res = validatePedigree(ped);
    expect(res.ok).to.be.true;
    expect(res.reasons.length).to.eql(0);
    expect(res.problematic.size).to.eql(0);
    expect(Object.keys(res.whys).length).to.eql(0);
  });
  it("duplicated sample", () => {
    const ped: PedigreeEntry[] = [
      {
        family: "FAM01",
        sample: "SAM001",
        mother: "SAM002",
        father: "SAM003",
        sex: 1,
      },
      {
        family: "FAM01",
        sample: "SAM001",
        mother: "SAM002",
        father: "SAM003",
        sex: 2,
      },
    ];
    const res = validatePedigree(ped);
    expect(res).to.eql({
      ok: false,
      reasons: ["Pedigree contains duplicate rows for at least one individual."],
      problematic: new Set<DefiniteIdentifier>(["SAM001"]),
      whys: { SAM001: ["Duplicate sample."] },
    });
  });
  it("parent as both father and mother", () => {
    const ped: PedigreeEntry[] = [
      {
        family: "FAM01",
        sample: "SAM001",
        mother: "SAM002",
        father: "SAM002",
        sex: "Female",
      },
    ];
    const res = validatePedigree(ped);
    expect(res).to.eql({
      ok: false,
      reasons: ["There is at least one sample used as both father and mother"],
      problematic: new Set<DefiniteIdentifier>(["SAM002"]),
      whys: { SAM002: ["Both a mother and a father."] },
    });
  });
  it("parent as both father and mother", () => {
    const ped: PedigreeEntry[] = [
      {
        family: "FAM01",
        sample: "SAM001",
        mother: "SAM002",
        father: "SAM003",
        sex: "Female",
      },
      {
        family: "FAM01",
        sample: "SAM002",
        mother: null,
        father: null,
        sex: "Male",
      },
      {
        family: "FAM01",
        sample: "SAM003",
        mother: null,
        father: null,
        sex: "Female",
      },
    ];
    const res = validatePedigree(ped);
    expect(res).to.eql({
      ok: false,
      reasons: ["At least one sample has inconsistent sex."],
      problematic: new Set<DefiniteIdentifier>(["SAM002", "SAM003"]),
      whys: { SAM002: ["Sample is a mother, but is assigned male."], SAM003: ["Sample is a father, but is assigned female."] },
    });
  });
});

describe("Validation on some randomly generated pedigrees", () => {
  it("example 1", () => {
    const ped: PedigreeEntry[] = [
      { family: "FAM01", sample: "S0", mother: null, father: null, sex: "2" },
      { family: "FAM01", sample: "S1", mother: null, father: null, sex: "1" },
      { family: "FAM01", sample: "S3", mother: null, father: "S1", sex: "2" },
      { family: "FAM01", sample: "S5", mother: null, father: null, sex: "2" },
      { family: "FAM01", sample: "S6", mother: null, father: null, sex: "2" },
      { family: "FAM01", sample: "S8", mother: "S0", father: "S1", sex: "1" },
      { family: "FAM01", sample: "S9", mother: "S5", father: "S1", sex: "1" },
      { family: "FAM01", sample: "S10", mother: "S6", father: "S8", sex: "2" },
      { family: "FAM01", sample: "S11", mother: "S0", father: "S9", sex: "1" },
    ];
    const res = validatePedigree(ped);
    expect(res.ok).to.be.true;
    expect(res.reasons.length).to.eql(0);
    expect(res.problematic.size).to.eql(0);
    expect(Object.keys(res.whys).length).to.eql(0);
  });
  it("example 2", () => {
    const ped: PedigreeEntry[] = [
      { family: "FAM01", sample: "S0", mother: null, father: null, sex: "1" },
      { family: "FAM01", sample: "S1", mother: null, father: null, sex: "2" },
      { family: "FAM01", sample: "S2", mother: null, father: null, sex: "1" },
      { family: "FAM01", sample: "S3", mother: "S1", father: "S0", sex: "2" },
      { family: "FAM01", sample: "S4", mother: "S1", father: "S0", sex: "1" },
      { family: "FAM01", sample: "S5", mother: "S1", father: null, sex: "2" },
      { family: "FAM01", sample: "S6", mother: "S1", father: "S2", sex: "2" },
      { family: "FAM01", sample: "S7", mother: "S1", father: "S4", sex: "2" },
      { family: "FAM01", sample: "S8", mother: "S5", father: null, sex: "1" },
    ];
    const res = validatePedigree(ped);
    expect(res.ok).to.be.true;
    expect(res.reasons.length).to.eql(0);
    expect(res.problematic.size).to.eql(0);
    expect(Object.keys(res.whys).length).to.eql(0);
  });
  it("example 2", () => {
    const ped: PedigreeEntry[] = [
      { family: "FAM01", sample: "S0", mother: null, father: null, sex: "1" },
      { family: "FAM01", sample: "S1", mother: null, father: null, sex: "1" },
      { family: "FAM01", sample: "S2", mother: null, father: "S1", sex: "2" },
      { family: "FAM01", sample: "S3", mother: null, father: "S0", sex: "2" },
      { family: "FAM01", sample: "S4", mother: null, father: null, sex: "2" },
      { family: "FAM01", sample: "S5", mother: null, father: "S0", sex: "2" },
      { family: "FAM01", sample: "S6", mother: "S3", father: "S0", sex: "1" },
      { family: "FAM01", sample: "S7", mother: null, father: null, sex: "1" },
      { family: "FAM01", sample: "S8", mother: "S2", father: null, sex: "1" },
      { family: "FAM01", sample: "S9", mother: "S3", father: "S0", sex: "1" },
      { family: "FAM01", sample: "S10", mother: "S4", father: "S7", sex: "1" },
      { family: "FAM01", sample: "S11", mother: "S2", father: "S8", sex: "1" },
    ];
    const res = validatePedigree(ped);
    expect(res).to.eql({
      ok: true,
      reasons: ["Not all samples are connected."],
      problematic: new Set<DefiniteIdentifier>(["S1", "S11", "S2", "S8", "S10", "S4", "S7"]),
      whys: {
        S1: ["Sample is not connected."],
        S2: ["Sample is not connected."],
        S8: ["Sample is not connected."],
        S11: ["Sample is not connected."],
        S4: ["Sample is not connected."],
        S7: ["Sample is not connected."],
        S10: ["Sample is not connected."],
      },
    });
  });
});
