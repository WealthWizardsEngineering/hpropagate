'use strict'

const tracer = require('./lib/tracer')
const httpWrapper = require('./lib/http_wrapper')

module.exports = (overrides) => {
    httpWrapper.wrapHttp(require('./lib/config').load(overrides))

    tracer.enable()
}