'use strict'

const tracer = require('./lib/tracer')
const http_wrapper = require('./lib/http_wrapper')

http_wrapper.wrapHttp()

tracer.enable()