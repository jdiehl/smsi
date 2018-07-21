import * as meow from 'meow'
import * as recipes from './recipes'

const args = meow(`
Usage
  $ smsi init <project>  Initialize a new project
  $ smsi service <service>  Create a new microservice
  $ smsi method <service> <method>  Create and expose a new method for the given service
  $ smsi proxy <service> <path>  Create or update a service proxy
`, {
  flags: {
    lerna: {
      type: 'boolean',
      alias: 'l'
    }
  }
})

const command = args.input.shift()
if (!command) {
  console.log('no command')
  args.showHelp()
  process.exit(-1)
}

const recipe = (recipes as any)[command!]
if (typeof recipe !== 'function') {
  console.log('unknown command', command, recipes)
  args.showHelp()
  process.exit(-1)
}

recipe(args.input, args.flags)
