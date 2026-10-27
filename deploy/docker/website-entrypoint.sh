#!/bin/sh
set -eu
# The validator checks the shipped applicationReady marker before runtime values.
node scripts/validate-deployment-env.mjs website
exec "$@"
