'use strict'

const async_hooks = require('async_hooks')
const uuid =  require('uuid')

const tracer = module.exports = {
    traces: {}
}

const prevStates = {}
const hook = async_hooks.createHook({ init, before, after, destroy })

tracer.newTrace = (type) => {
    tracer.currentTrace = new Trace(type)
    tracer.traces[async_hooks.executionAsyncId()] = tracer.currentTrace
    return tracer.currentTrace
}

tracer.enable = () => hook.enable()

function init(asyncId, type, triggerAsyncId, resource) {
    if (tracer.traces[triggerAsyncId]) {
        tracer.traces[asyncId] = tracer.traces[triggerAsyncId]
    }
}

function before(asyncId) {
    if (!tracer.traces[asyncId]) {
        return
    }
    prevStates[asyncId] = tracer.currentTrace
    tracer.currentTrace = tracer.traces[asyncId]
}

function after(asyncId) {
    if (!tracer.traces[asyncId]) {
        return
    }
    tracer.currentTrace = prevStates[asyncId]
}

function destroy(asyncId) {
    if (tracer.traces[asyncId]) {
        delete tracer.traces[asyncId]
        delete prevStates[asyncId]
    }
}

class Trace {
    constructor(type) {
        this.id = uuid.v1()
        this.type = type
        this.context = new Map()
    }
}