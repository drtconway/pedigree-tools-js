"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePedigree = exports.permissive = exports.strict = void 0;
const algorithms_js_1 = require("algorithms-js");
const graph_1 = require("algorithms-js/dist/graph/graph");
exports.strict = {
    empty: "ignore",
    duplicates: "error",
    inconsistentSex: "error",
    multipleFamilies: "error",
    oneFamily: "error",
    fullyConnected: "error",
    cycles: "error",
};
exports.permissive = {
    empty: "ignore",
    duplicates: "warning",
    inconsistentSex: "error",
    multipleFamilies: "ignore",
    oneFamily: "ignore",
    fullyConnected: "warning",
    cycles: "error",
};
function zip(fst, snd) {
    const res = [];
    for (const x of fst) {
        res.push([x, snd]);
    }
    return res;
}
function addProblem(options, result, which, reason, whoAndWhy) {
    switch (options[which]) {
        case "error": {
            result.ok = false;
            // fall-through!
        }
        case "warning": {
            result.reasons.push(reason);
            if (whoAndWhy) {
                for (const itm of whoAndWhy) {
                    const who = itm[0];
                    const why = itm[1];
                    result.problematic.add(who);
                    if (!(who in result.whys)) {
                        result.whys[who] = [];
                    }
                    result.whys[who].push(why);
                }
            }
            // fall-through!
        }
        case "ignore": {
            break;
        }
    }
}
function validatePedigree(ped, options = exports.strict) {
    let result = { ok: true, reasons: [], problematic: new Set(), whys: {} };
    // If it's empty, report if necessary, and return.
    //
    if (ped.length == 0) {
        addProblem(options, result, "empty", "An empty pedigree is not permitted.");
        return result;
    }
    // For now, only 1 family is permitted,
    // and every sample must have a family.
    //
    const fams = {};
    const famids = [];
    for (let row of ped) {
        const famid = row.family;
        if (!(famid in fams)) {
            fams[famid] = [];
            famids.push(famid);
        }
        fams[famid].push(row);
    }
    if (famids.length > 1) {
        addProblem(options, result, "multipleFamilies", "The pedigree contains multiple families.");
    }
    const famIdx = {};
    const familyProblems = [];
    for (const famid of famids) {
        for (const row of fams[famid]) {
            const whos = [row.sample];
            if (row.father) {
                whos.push(row.father);
            }
            if (row.mother) {
                whos.push(row.mother);
            }
            for (const who of whos) {
                if (!(who in famIdx)) {
                    famIdx[who] = new Set();
                }
                famIdx[who].add(famid);
            }
        }
    }
    for (const who in famIdx) {
        if (famIdx[who].size > 1) {
            familyProblems.push([who, "Individual belongs to more than one family."]);
        }
    }
    if (familyProblems.length > 0) {
        addProblem(options, result, "oneFamily", "The pedigree contains individuals who belong to more than one family.", familyProblems);
    }
    // Normalise the sex for each row.
    //
    for (const row of ped) {
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
    let duplicates = new Set();
    let kids = new Set();
    let dads = new Set();
    let mums = new Set();
    for (let row of ped) {
        if (kids.has(row.sample)) {
            duplicates.add(row.sample);
            continue;
        }
        kids.add(row.sample);
        if (row.father) {
            dads.add(row.father);
        }
        if (row.mother) {
            mums.add(row.mother);
        }
    }
    if (duplicates.size > 0) {
        addProblem(options, result, "duplicates", "Pedigree contains duplicate rows for at least one individual.", zip(duplicates, "Person is defined in more than one line of the pedigree."));
    }
    let both = algorithms_js_1.set.intersection(dads, mums);
    if (both.size > 0) {
        addProblem(options, result, "duplicates", "There is at least one sample used as both father and mother.", zip(both, "Person is used as both a mother and a father."));
    }
    // Check dads are male and mums are female.
    //
    let inconsistentSexMums = new Set();
    let inconsistentSexDads = new Set();
    for (let row of ped) {
        let who = row.sample;
        if (row.sex != "Female" && mums.has(who)) {
            inconsistentSexMums.add(who);
        }
        if (row.sex != "Male" && dads.has(who)) {
            inconsistentSexDads.add(who);
        }
    }
    if (inconsistentSexMums.size > 0) {
        addProblem(options, result, "inconsistentSex", "There is at least one sample that occurs as a mother but is not female.", zip(inconsistentSexMums, "Person is not female, but occurs as a mother."));
    }
    if (inconsistentSexDads.size > 0) {
        addProblem(options, result, "inconsistentSex", "There is at least one sample that occurs as a father but is not male.", zip(inconsistentSexDads, "Person is not male, but occurs as a father."));
    }
    const unconnected = [];
    const cyclic = new Set();
    // Now process families one by one.
    //
    for (const famid in fams) {
        // Create indexes.
        //
        let kids = new Set();
        let dads = new Set();
        let mums = new Set();
        let parent = {};
        let child = {};
        for (let row of fams[famid]) {
            let kid = row.sample;
            let dad = row.father;
            let mum = row.mother;
            kids.add(row.sample);
            if (dad) {
                dads.add(dad);
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
                mums.add(mum);
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
        let uf = new algorithms_js_1.set.UnionFind();
        for (const row of fams[famid]) {
            const kid = row.sample;
            const dad = row.father;
            const mum = row.mother;
            if (dad) {
                uf.union(kid, dad);
            }
            if (mum) {
                uf.union(kid, mum);
            }
        }
        const everyone = [...algorithms_js_1.set.union(kids, dads, mums)];
        // Step 2: make an index that groups the connected
        // samples into sets.
        //
        const idx = {};
        const keys = new Set();
        for (const who of everyone) {
            const key = uf.find(who);
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
            // Step 3a: figure out the biggest group.
            //
            let maxSet = new Set();
            for (let key of keys) {
                if (idx[key].size > maxSet.size) {
                    maxSet = idx[key];
                }
            }
            // Step 3b: flag samples from the not-biggest groups.
            //
            for (let who of everyone) {
                if (maxSet.has(who)) {
                    continue;
                }
                unconnected.push([who, "Individual is not properly connected to pedigree."]);
            }
        }
        // Now check that everyone is stratified, that is,
        // there are no cycles in the graph.
        //
        const children = [];
        for (const who in child) {
            for (const kid of child[who]) {
                if (who == kid) {
                    cyclic.add(who);
                    continue;
                }
                children.push([who, kid]);
            }
        }
        const G = new graph_1.Graph(everyone, children);
        const sccs = algorithms_js_1.graph.tarjan(G);
        for (let scc of sccs) {
            // Every strongly connected component should be singleton,
            // otherwise it's a cycle, and we should report it.
            if (scc.length > 1) {
                for (const who of scc) {
                    cyclic.add(who);
                }
            }
        }
    }
    if (unconnected.length > 0) {
        addProblem(options, result, "fullyConnected", "At least one individual is not properly connected to family.", unconnected);
    }
    if (cyclic.size > 0) {
        addProblem(options, result, "cycles", "There was at least one instance of someone being their own ancestor.", zip(cyclic, "Sample is an ancestor of itself."));
    }
    return result;
}
exports.validatePedigree = validatePedigree;
