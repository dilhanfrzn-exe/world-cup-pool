import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeName,
  buildNameLookup,
  matchApiTeamName,
} from "../team-match";

test("normalizeName strips diacritics, case and punctuation", () => {
  assert.equal(normalizeName("Türkiye"), "turkiye");
  assert.equal(normalizeName("Côte d'Ivoire"), "cotedivoire");
  assert.equal(normalizeName("Bosnia & Herzegovina"), "bosniaandherzegovina");
  assert.equal(normalizeName("United States"), "unitedstates");
});

test("matchApiTeamName resolves exact and aliased names", () => {
  const lookup = buildNameLookup([
    "United States",
    "South Korea",
    "Türkiye",
    "Ivory Coast",
    "Brazil",
  ]);

  assert.equal(matchApiTeamName("USA", lookup), "United States");
  assert.equal(matchApiTeamName("Korea Republic", lookup), "South Korea");
  assert.equal(matchApiTeamName("Turkey", lookup), "Türkiye");
  assert.equal(matchApiTeamName("Cote d'Ivoire", lookup), "Ivory Coast");
  assert.equal(matchApiTeamName("Brazil", lookup), "Brazil");
});

test("matchApiTeamName returns null for unknown teams", () => {
  const lookup = buildNameLookup(["Brazil", "Argentina"]);
  assert.equal(matchApiTeamName("Italy", lookup), null);
});
