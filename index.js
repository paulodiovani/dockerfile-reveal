const { exec } = require('child_process')

const compose = (...fns) => fns.reduce((f, g) => (...args) => f(g(...args)))

const dockerInspect = (image) => {
  return new Promise((resolve, reject) => {
    exec(`docker inspect ${image}`, (err, stdout, stderr) => {
      if (err) return reject(err)
      if (stderr) return reject(stderr)
      resolve(stdout)
    })
  })
}

const parseCmd = compose(
  (cmd) => cmd.trim(),
  (cmd) => cmd.replace(/\s+/g, ' '),
  (cmd) => cmd[1] ? cmd[2] : `RUN ${cmd[2]}`,
  (cmd) => /(#\(nop\))?(.+)?/.exec(cmd),
  (cmd) => cmd.join(' '),
  (cmd) => cmd.slice(2)
)

const parseInspect = (stdout) => {
  const [{
    RepoTags: [Tag],
    Parent,
    ContainerConfig: {
      Cmd
    }
  }] = JSON.parse(stdout)

  return { Line: [Cmd ? parseCmd(Cmd) : null], Parent, Tag }
}

const recurse = ({Line, Parent, Tag}) => {
  if (Parent) {
    return dockerInspect(Parent)
      .then(parseInspect)
      .then(recurse)
      .then((previous) => Line.concat(previous))
  }

  return Line.concat([`FROM ${Tag}`])
}

const format = compose(
  (steps) => steps.join('\n'),
  (steps) => steps.reverse(),
  (steps) => steps.filter((item) => !!item)
)

const revealDockerfile = (image) => {
  return dockerInspect(image)
    .then(parseInspect)
    .then(recurse)
    .then(format)
}

module.exports = revealDockerfile
