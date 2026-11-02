#!/bin/sh
# fixture: enables repo-local hooks for lint on commit
git config core.hooksPath .githooks
echo "hooks enabled"
