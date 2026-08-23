#!/usr/bin/env node

import {randomUUID} from 'node:crypto'

process.stdout.write(`apg_${randomUUID().replaceAll('-', '')}\n`)
