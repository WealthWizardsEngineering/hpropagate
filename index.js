'use strict'

const tracer = require('./lib/tracer')
const httpWrapper = require('./lib/http_wrapper')

httpWrapper.wrapHttp()

tracer.enable()
