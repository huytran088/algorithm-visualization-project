#!/bin/sh
# Sourced by the nginx entrypoint (*.envsh) before templates are rendered.
# Ensures BASE_PATH has exactly one leading and one trailing slash.
trimmed=$(printf '%s' "${BASE_PATH:-/}" | sed -e 's#^/*##' -e 's#/*$##')
if [ -z "$trimmed" ]; then
  export BASE_PATH=/
  export ROOT_REDIRECT=""
else
  export BASE_PATH="/${trimmed}/"
  export ROOT_REDIRECT="location = / { return 302 ${BASE_PATH}; }"
fi
