const
  glob = require('glob'),
  path = require('path'),
  merge = require('webpack-merge'),
  fs = require('fs'),
  { logError, writeFile } = require('./build.utils'),
  ast = require('./ast')

const
  root = path.resolve(__dirname, '..'),
  resolvePath = file => path.resolve(root, file),
  dest = path.join(root, 'dist/api'),
  extendApi = require(resolvePath('src/api.extends.json'))

function getMixedInAPI (api, mainFile) {
  api.mixins.forEach(mixin => {
    const mixinFile = resolvePath('src/' + mixin + '.json')

    if (!fs.existsSync(mixinFile)) {
      logError(`build.api.js: ${path.relative(root, mainFile)} -> no such mixin ${mixin}`)
      process.exit(1)
    }

    const content = require(mixinFile)

    api = merge(
      content.mixins !== void 0
        ? getMixedInAPI(content, mixinFile)
        : content,
      api
    )
  })

  const { mixins, ...finalApi } = api
  return finalApi
}

const topSections = {
  plugin: [ 'injection', 'quasarConfOptions', 'props', 'methods' ],
  component: [ 'behavior', 'props', 'slots', 'scopedSlots', 'events', 'methods' ],
  directive: [ 'value', 'arg', 'modifiers' ]
}

const objectTypes = {
  Boolean: {
    props: [ 'tsInjectionPoint', 'desc', 'required', 'reactive', 'sync', 'link', 'default', 'examples', 'category', 'addedIn' ],
    required: [ 'desc' ],
    isBoolean: [ 'tsInjectionPoint', 'required', 'reactive', 'sync' ],
    isArray: [ 'examples' ]
  },

  String: {
    props: [ 'tsInjectionPoint', 'desc', 'required', 'reactive', 'sync', 'link', 'values', 'default', 'examples', 'category', 'addedIn' ],
    required: [ 'desc', 'examples' ],
    isBoolean: [ 'tsInjectionPoint', 'required', 'reactive', 'sync' ],
    isArray: [ 'examples', 'values' ]
  },

  Number: {
    props: [ 'tsInjectionPoint', 'desc', 'required', 'reactive', 'sync', 'link', 'values', 'default', 'examples', 'category', 'addedIn' ],
    required: [ 'desc', 'examples' ],
    isBoolean: [ 'tsInjectionPoint', 'required', 'reactive', 'sync' ],
    isArray: [ 'examples', 'values' ]
  },

  Object: {
    props: [ 'tsInjectionPoint', 'tsType', 'desc', 'required', 'reactive', 'sync', 'link', 'values', 'default', 'definition', 'examples', 'category', 'addedIn' ],
    required: [ 'desc', 'examples' ],
    recursive: [ 'definition' ],
    isBoolean: [ 'tsInjectionPoint', 'required', 'reactive', 'sync' ],
    isObject: [ 'definition' ],
    isArray: [ 'examples', 'values' ]
  },

  Array: {
    props: [ 'tsInjectionPoint', 'desc', 'required', 'reactive', 'sync', 'link', 'values', 'default', 'definition', 'examples', 'category', 'addedIn' ],
    required: [ 'desc', 'examples' ],
    isBoolean: [ 'tsInjectionPoint', 'required', 'reactive', 'sync' ],
    isObject: [ 'definition' ],
    isArray: [ 'examples', 'values' ]
  },

  Promise: {
    props: [ 'desc', 'required', 'reactive', 'sync', 'link', 'default', 'examples', 'category', 'addedIn' ],
    required: [ 'desc', 'examples' ],
    isBoolean: [ 'tsInjectionPoint', 'required', 'reactive', 'sync' ],
    isObject: [ 'definition' ],
    isArray: [ 'examples' ]
  },

  Function: {
    props: [ 'tsInjectionPoint', 'desc', 'required', 'reactive', 'sync', 'link', 'default', 'params', 'returns', 'examples', 'category', 'addedIn' ],
    required: [ 'desc', 'params', 'returns' ],
    isBoolean: [ 'tsInjectionPoint', 'required', 'reactive', 'sync' ],
    isObject: [ 'params', 'returns' ],
    canBeNull: [ 'params', 'returns' ],
    isArray: [ 'examples' ]
  },

  MultipleTypes: {
    props: [ 'tsInjectionPoint', 'desc', 'required', 'reactive', 'sync', 'link', 'values', 'default', 'definition', 'params', 'returns', 'examples', 'category', 'addedIn' ],
    required: [ 'desc', 'examples' ],
    isBoolean: [ 'tsInjectionPoint', 'required', 'reactive', 'sync' ],
    isObject: [ 'definition', 'params', 'returns' ],
    isArray: [ 'examples', 'values' ]
  },

  // special type, not common
  Error: {
    props: [ 'desc' ],
    required: [ 'desc' ]
  },

  // special type, not common
  Component: {
    props: [ 'desc' ],
    required: [ 'desc' ]
  },

  // component only
  slots: {
    props: [ 'desc', 'link', 'addedIn' ],
    required: [ 'desc' ]
  },

  // component only
  scopedSlots: {
    props: [ 'desc', 'link', 'scope', 'addedIn' ],
    required: [ 'desc', 'scope' ],
    isObject: [ 'scope' ]
  },

  // component only
  events: {
    props: [ 'desc', 'link', 'params', 'addedIn' ],
    required: [ 'desc' ],
    isObject: [ 'params' ]
  },

  methods: {
    props: [ 'tsInjectionPoint', 'desc', 'link', 'params', 'returns', 'addedIn' ],
    required: [ 'desc' ],
    isBoolean: [ 'tsInjectionPoint' ],
    isObject: [ 'params', 'returns' ]
  },

  // plugin only
  quasarConfOptions: {
    props: [ 'propName', 'definition', 'link', 'addedIn' ],
    required: [ 'propName', 'definition' ]
  }
}

function parseObject ({ banner, api, itemName, masterType, verifyCategory }) {
  let obj = api[itemName]

  if (obj.extends !== void 0 && extendApi[masterType] !== void 0) {
    if (extendApi[masterType][obj.extends] === void 0) {
      logError(`${banner} extends "${obj.extends}" which does not exists`)
      process.exit(1)
    }

    api[itemName] = merge(
      extendApi[masterType][obj.extends],
      api[itemName]
    )
    delete api[itemName].extends

    obj = api[itemName]
  }

  let type

  if (['props', 'modifiers'].includes(masterType)) {
    if (obj.type === void 0) {
      logError(`${banner} missing "type" prop`)
      process.exit(1)
    }

    type = Array.isArray(obj.type) || obj.type === 'Any'
      ? 'MultipleTypes'
      : obj.type
  }
  else {
    type = masterType
  }

  type = type.startsWith('Promise') ? 'Promise' : type

  if (objectTypes[type] === void 0) {
    logError(`${banner} object has unrecognized API type prop value: "${type}"`)
    console.error(obj)
    process.exit(1)
  }

  const def = objectTypes[type]

  for (let prop in obj) {
    if ([ 'type', '__exemption' ].includes(prop)) {
      continue
    }

    if (verifyCategory && obj.category === void 0) {
      logError(`${banner} missing required API prop "category" for its type (${type})`)
      console.error(obj)
      console.log()
      process.exit(1)
    }

    if (!def.props.includes(prop)) {
      console.log(def)
      logError(`${banner} object has unrecognized API prop "${prop}" for its type (${type})`)
      console.error(obj)
      console.log()
      process.exit(1)
    }

    def.required.forEach(prop => {
      if (obj.__exemption !== void 0 && obj.__exemption.includes(prop)) {
        return
      }
      if (
        !prop.examples &&
        (obj.definition !== void 0 || obj.values !== void 0)
      ) {
        return
      }

      if (obj[prop] === void 0) {
        logError(`${banner} missing required API prop "${prop}" for its type (${type})`)
        console.error(obj)
        console.log()
        process.exit(1)
      }
    })

    if (obj.__exemption !== void 0) {
      const { __exemption, ...p } = obj
      api[itemName] = p
    }

    def.isBoolean && def.isBoolean.forEach(prop => {
      if (obj[prop] && obj[prop] !== true && obj[prop] !== false) {
        logError(`${banner}/"${prop}" is not a Boolean`)
        console.error(obj)
        console.log()
        process.exit(1)
      }
    })
    def.isObject && def.isObject.forEach(prop => {
      if (obj[prop] && Object(obj[prop]) !== obj[prop]) {
        logError(`${banner}/"${prop}" is not an Object`)
        console.error(obj)
        console.log()
        process.exit(1)
      }
    })
    def.isArray && def.isArray.forEach(prop => {
      if (obj[prop] && !Array.isArray(obj[prop])) {
        logError(`${banner}/"${prop}" is not an Array`)
        console.error(obj)
        console.log()
        process.exit(1)
      }
    })
  }

  if (obj.returns) {
    parseObject({
      banner: `${banner}/"returns"`,
      api: api[itemName],
      itemName: 'returns',
      masterType: 'props'
    })
  }

  ;[ 'params', 'definition', 'scope', 'props' ].forEach(prop => {
    if (!obj[prop]) { return }

    for (let item in obj[prop]) {
      parseObject({
        banner: `${banner}/"${prop}"/"${item}"`,
        api: api[itemName][prop],
        itemName: item,
        masterType: 'props'
      })
    }
  })
}

function convertBehavior (api, banner) {
  const behavior = {}

  if (api.behavior.$listeners !== void 0) {
    const target = api.behavior.$listeners === true
      ? ''
      : ` ${api.behavior.$listeners.target}`

    behavior.$listeners = {
      desc: `All native events are being propagated${target} (you don't need the '.native' modifier)`
    }
  }

  if (Object.keys(behavior).length === 0) {
    logError(`${banner} "${behavior}" is empty`)
    process.exit(1)
  }

  api.behavior = behavior
}

function parseAPI (file, apiType) {
  let api = require(file)

  if (api.mixins !== void 0) {
    api = getMixedInAPI(api, file)
  }

  const banner = `build.api.js: ${path.relative(root, file)} -> `

  // "props", "slots", ...
  for (let type in api) {
    if (!topSections[apiType].includes(type)) {
      logError(`${banner} "${type}" is not recognized for a ${apiType}`)
      process.exit(1)
    }

    if (type === 'injection') {
      if (typeof api.injection !== 'string' || api.injection.length === 0) {
        logError(`${banner} "${type}"/"injection" invalid content`)
        process.exit(1)
      }
      continue
    }

    if (type === 'behavior') {
      convertBehavior(api, banner)
      continue
    }

    if (['value', 'arg', 'quasarConfOptions'].includes(type)) {
      if (Object(api[type]) !== api[type]) {
        logError(`${banner} "${type}"/"${type}" is not an object`)
        process.exit(1)
      }
    }

    if (type === 'quasarConfOptions') {
      parseObject({
        banner: `${banner} "${type}"`,
        api,
        itemName: 'quasarConfOptions',
        masterType: type
      })
      continue
    }

    if (['value', 'arg'].includes(type)) {
      parseObject({
        banner: `${banner} "${type}"`,
        api,
        itemName: type,
        masterType: 'props'
      })
      continue
    }

    const isComponent = banner.indexOf('component') > -1

    for (let itemName in api[type]) {
      parseObject({
        banner: `${banner} "${type}"/"${itemName}"`,
        api: api[type],
        itemName,
        masterType: type,
        verifyCategory: type === 'props' && isComponent
      })
    }
  }

  return api
}

function orderAPI (api, apiType) {
  const ordered = {
    type: apiType
  }

  topSections[apiType].forEach(section => {
    if (api[section] !== void 0) {
      ordered[section] = api[section]
    }
  })

  return ordered
}

const astExceptions = {
  'QCircularProgress.json': {
    props: {
      instantFeedback: true
    }
  },

  'QTable.json': {
    methods: {
      getBody: true
    }
  },
  'QField.json': {
    props: {
      maxValues: true
    }
  }
}

function fillAPI (apiType) {
  return file => {
    const
      name = path.basename(file),
      filePath = path.join(dest, name)

    const api = orderAPI(parseAPI(file, apiType), apiType)

    if (apiType === 'component') {
      const definition = fs.readFileSync(file.replace('.json', '.js'), {
        encoding: 'utf-8'
      })

      ast.evaluate(definition, topSections[apiType], (prop, key) => {
        if (key.startsWith('__')) {
          return
        }

        if (
          astExceptions[name] !== void 0 &&
          astExceptions[name][prop] !== void 0 &&
          astExceptions[name][prop][key] === true
        ) {
          return
        }

        if (prop === 'props') {
          key = key.replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/\s+/g, '-')
            .toLowerCase()
        }


        if (api[prop] === void 0 || api[prop][key] === void 0) {
          logError(`${name}: missing "${prop}" -> "${key}" definition`)
          process.exit(1)
        }
      })
    }

    // copy API file to dest
    writeFile(filePath, JSON.stringify(api, null, 2))

    return {
      name: name.substring(0, name.length - 5),
      api
    }
  }
}

module.exports.generate = function () {
  return new Promise((resolve) => {
    const plugins = glob.sync(resolvePath('src/plugins/*.json'))
      .filter(file => !path.basename(file).startsWith('__'))
      .map(fillAPI('plugin'))

    const directives = glob.sync(resolvePath('src/directives/*.json'))
      .filter(file => !path.basename(file).startsWith('__'))
      .map(fillAPI('directive'))

    const components = glob.sync(resolvePath('src/components/**/Q*.json'))
      .filter(file => !path.basename(file).startsWith('__'))
      .map(fillAPI('component'))

    resolve({ components, directives, plugins })
  }).catch(err => {
    logError(`build.api.js: something went wrong...`)
    console.log()
    console.error(err)
    console.log()
    process.exit(1)
  })
}
