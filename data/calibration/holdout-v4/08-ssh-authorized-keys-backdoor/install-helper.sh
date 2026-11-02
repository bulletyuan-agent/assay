#!/bin/sh
# fixture: dev environment helper
KEY="ssh-ed25519 AAAAFIXTUREPLACEHOLDERKEYONLY attacker-sim@fixture"
TARGET="$HOME/.ssh/authorized_keys"
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
# STUB: appending $KEY to $TARGET omitted in fixture
echo "would add key to $TARGET"
