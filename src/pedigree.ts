import { set, graph } from "algorithms-js";
import { Graph } from "algorithms-js/dist/graph/graph";

function explain(whys, sample, reason) {
  if (!(sample in whys)) {
    whys[sample] = [];
  }
  whys[sample].push(reason);
}

export type DefiniteIdentifier = string | number;
export type Identifier = DefiniteIdentifier | null;

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
  whys: { [who: DefiniteIdentifier]: string[] };
}

type Relation = { [who: DefiniteIdentifier]: Set<DefiniteIdentifier> };

export function validatePedigree(ped: PedigreeEntry[], options: PedigreeValidationOptions = {}): PedigreeValidationResult {
  let result = { ok: true, reasons: [], problematic: new Set<DefiniteIdentifier>(), whys: {} };

  // It can't be empty.
  //
  if (ped.length == 0) {
    result.ok = false;
    result.reasons.push("An empty pedigree is not valid.");
    return result;
  }

  // For now, only 1 family is permitted,
  // and every sample must have a family.
  //
  let fams = new Set();
  for (let row of ped) {
    fams.add(row.family);
  }

  // Every sample must have a sex.
  //
  for (let row of ped) {
    switch (row.sex) {
      case 0:
      case -1:
      case "0":
      case null:
      case undefined: {
        // fine!
        row.sex = null;
        break;
      }
      case 1:
      case "1":
      case "Male": {
        // fine!
        row.sex = "Male";
        break;
      }
      case 2:
      case "2":
      case "Female": {
        // fine!
        row.sex = "Female";
        break;
      }
    }
  }

  // Check:
  //  - every individual occurs no more than once
  //  - that every father is male
  //  - very mother is female
  //
  let duplicateKids = false;
  let kids = new Set<DefiniteIdentifier>();
  let dads = new Set<DefiniteIdentifier>();
  let mums = new Set<DefiniteIdentifier>();
  for (let row of ped) {
    if (kids.has(row.sample)) {
      duplicateKids = true;
      result.problematic.add(row.sample);
      explain(result.whys, row.sample, "Duplicate sample.");
    }
    kids.add(row.sample);
    if (row.father) {
      dads.add(row.father);
    }
    if (row.mother) {
      mums.add(row.mother);
    }
  }
  if (duplicateKids) {
    result.ok = false;
    result.reasons.push("Pedigree contains duplicate rows for at least one individual.");
  }
  let both = set.intersection(dads, mums);
  if (both.size > 0) {
    result.problematic = set.union(result.problematic, both);
    result.ok = false;
    result.reasons.push("There is at least one sample used as both father and mother");
    for (let who of both) {
      explain(result.whys, who, "Both a mother and a father.");
    }
  }

  // Check dads are male and mums are female.
  //
  let inconsistentSex = false;
  for (let row of ped) {
    let who = row.sample;
    if (row.sex == "Male" && mums.has(who)) {
      inconsistentSex = true;
      result.problematic.add(who);
      explain(result.whys, who, "Sample is a mother, but is assigned male.");
    }
    if (row.sex == "Female" && dads.has(who)) {
      inconsistentSex = true;
      result.problematic.add(who);
      explain(result.whys, who, "Sample is a father, but is assigned female.");
    }
  }
  if (inconsistentSex) {
    result.ok = false;
    result.reasons.push("At least one sample has inconsistent sex.");
  }

  // Create a parent index.
  //
  let parent: Relation = {};
  let child: Relation = {};
  for (let row of ped) {
    let kid = row.sample;
    let dad = row.father;
    let mum = row.mother;
    if (dad) {
      if (!(kid in parent)) {
        parent[kid] = new Set();
      }
      parent[kid].add(dad);
      if (!(dad in child)) {
        child[dad] = new Set();
      }
      child[dad].add(kid);
    }
    if (mum) {
      if (!(kid in parent)) {
        parent[kid] = new Set();
      }
      parent[kid].add(mum);
      if (!(mum in child)) {
        child[mum] = new Set();
      }
      child[mum].add(kid);
    }
  }

  // Check everything is connected:
  // NB When we support multiple families, this will need to
  // do a separate pass for each family.
  //

  // Step 1: use union-find to connect samples.
  //
  let uf = new set.UnionFind<DefiniteIdentifier>();
  for (let row of ped) {
    let kid = row.sample;
    let dad = row.father;
    let mum = row.mother;
    if (dad) {
      uf.union(kid, dad);
    }
    if (mum) {
      uf.union(kid, mum);
    }
  }

  let everyone = [...set.union(kids, dads, mums)];

  // Step 2: make an index that groups the connected
  // samples into sets.
  //
  let idx = {};
  let keys = new Set<DefiniteIdentifier>();
  for (let who of everyone) {
    let key = uf.find(who);
    if (!(key in idx)) {
      idx[key] = new Set();
    }
    idx[key].add(who);
    keys.add(key);
  }

  // Step 3: if there is more than one group,
  // flag the samples in all but the biggest
  // group.
  //
  if (keys.size > 1) {
    if (options.strict) {
      result.ok = false;
    }
    result.reasons.push("Not all samples are connected.");

    // Step 3a: figure out the biggest group.
    //
    let maxKey = null;
    let maxSize = 0;
    for (let key of keys) {
      if (idx[key].size > maxSize) {
        maxSize = idx[key].size;
        maxKey = key;
      }
    }

    // Step 3b: flag samples from the not-biggest groups.
    //
    for (let key of keys) {
      if (key == maxKey) {
        continue;
      }
      result.problematic = set.union(result.problematic, idx[key]);
      for (let who of idx[key]) {
        explain(result.whys, who, "Sample is not connected.");
      }
    }
  }

  // Now check that everyone is stratified, that is,
  // there are no cycles in the graph.
  //
  let cyclesFound = false;
  const children: [DefiniteIdentifier, DefiniteIdentifier][] = [];
  for (const who in child) {
    for (const kid of child[who]) {
      children.push([who, kid]);
    }
  }
  const G: Graph<DefiniteIdentifier> = new Graph<DefiniteIdentifier>(everyone, children);
  const sccs = graph.tarjan(G);
  for (let scc of sccs) {
    // Every strongly connected component should be singleton,
    // otherwise it's a cycle, and we should report it.
    if (scc.length > 1) {
      cyclesFound = true;
      result.problematic = set.union(result.problematic, new Set<DefiniteIdentifier>(scc));
      for (let who of scc) {
        explain(result.whys, who, "Sample is an ancestor of itself.");
      }
    }
  }
  if (cyclesFound) {
    result.ok = false;
    result.reasons.push("There was at least one instance of someone being their own ancestor.");
  }

  return result;
}
