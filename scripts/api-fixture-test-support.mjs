// Owner tests supply tiny disposable Node programs instead of launching HTTP.
export async function createApiFixture(
  put,
  program = "// Owned test program.\n",
) {
  await put("scripts/website-api-fixture.mjs", program);
}
