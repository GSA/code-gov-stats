// const Octokit = require('@octokit/rest')
const JsonFile = require('jsonfile')
const path = require('path')
const { createLogger, format, transports } = require('winston')
const { combine, timestamp, prettyPrint } = format
const { spawn } = require('child_process')
const { isGithubUrl, getGithubInformation, parseGithubUrl } = require('./github-utils')
const fetch = require('node-fetch')

function setInventoryStats ({usageType, repositoryUrl, stats, logger}) {
  logger.debug('getInventoryStats.')

  if (usageType === 'openSource') {
    stats.totalOpenSourceProjects = stats.hasOwnProperty('totalOpenSourceProjects')
      ? stats.totalOpenSourceProjects + 1 : 0
  }
  if (usageType === 'governmentWideReuse') {
    stats.totalGovernmentWideReuse = stats.hasOwnProperty('totalGovernmentWideReuse')
      ? stats.totalGovernmentWideReuse + 1 : 0
  }
  if (usageType === 'exemptByLaw') {
    stats.totalExemptByLaw = stats.hasOwnProperty('totalExemptByLaw')
      ? stats.totalExemptByLaw + 1 : 0
  }
  if (usageType === 'exemptByNationalSecurity') {
    stats.totalExemptByNationalSecurity = stats.hasOwnProperty('totalExemptByNationalSecurity')
      ? stats.totalExemptByNationalSecurity + 1 : 0
  }
  if (usageType === 'exemptByAgencySystem') {
    stats.totalExemptByAgencySystem = stats.hasOwnProperty('totalExemptByAgencySystem')
      ? stats.totalExemptByAgencySystem + 1 : 0
  }
  if (usageType === 'exemptByAgencyMission') {
    stats.totalExemptByAgencyMission = stats.hasOwnProperty('totalExemptByAgencyMission')
      ? stats.totalExemptByAgencyMission + 1 : 0
  }
  if (usageType === 'exemptByCIO') {
    stats.totalExemptByCIO = stats.hasOwnProperty('totalExemptByCIO')
      ? stats.totalExemptByCIO + 1 : 0
  }
  if (usageType === 'exemptByPolicyDate') {
    stats.totalExemptByPolicyDate = stats.hasOwnProperty('totalExemptByPolicyDate')
      ? stats.totalExemptByPolicyDate + 1 : 0
  }
  if (repositoryUrl) {
    if (isGithubUrl(repositoryUrl)) {
      stats.totalProjectsGithub = stats.hasOwnProperty('totalProjectsGithub')
        ? stats.totalProjectsGithub + 1 : 0
    } else {
      stats.totalProjectsOtherVcsService = stats.hasOwnProperty('totalProjectsOtherVcsService')
        ? stats.totalProjectsOtherVcsService + 1 : 0
    }
  } else {
    stats.totalProjectsNoRepoUrl = stats.hasOwnProperty('totalProjectsNoRepoUrl')
      ? stats.totalProjectsNoRepoUrl + 1 : 0
  }
}

function addToGithubList ({usageType, repositoryUrl, githubRepos}) {
  if (usageType === 'openSource' && isGithubUrl(repositoryUrl)) {
    githubRepos.push(repositoryUrl)
  }
}

function getGithubStatsFromList (repoUrls, logger) {
  repoUrls = repoUrls.filter(repoUrl => isGithubUrl(repoUrl))
  return getGithubInformation({repoUrls, logger})
}

function cloneRepo (repoUrl) {
  const { repo } = parseGithubUrl(repoUrl)
  const git = spawn('git', ['clone', repoUrl, path.join(path.dirname(__dirname), `/data/repos/${repo}`)])

  git.stdout.on('data', data => console.log(`stdout: ${data}`))
  git.stderr.on('error', data => console.error(`stderror: ${data}`))
  git.on('close', code => console.log(`closed with code: ${code}`))
}

function cloneTopRepos (topRepos) {
  topRepos.forEach(repo => {
    cloneRepo(repo.url)
  })
}

function writeOutData (data, filename) {
  JsonFile.writeFile(path.join(path.dirname(__dirname), `/data/${filename}`), data, { spaces: 2, encoding: 'utf8' },
    (error) => {
      if (error) {
        throw error
      }
    })
}

function getLogger () {
  return createLogger({
    format: combine(
      // label({ label: 'right meow!' }),
      timestamp(),
      prettyPrint()
    ),
    transports: [
      new transports.Console({level: 'debug'}),
      new transports.File({
        level: 'info',
        filename: path.join(path.dirname(__dirname), 'code-gov-stats.log')
      })
    ]
  })
}

function getAppVersion () {
  const packageJson = JsonFile.readFileSync(path.join(path.dirname(__dirname), 'package.json'))

  return packageJson.version
}

function getCodeGovReleasesFile (fileUrl, filePath, logger) {
  return fetch(fileUrl)
    .then(response => response.json())
    .then(codeGovReleases => {
      JsonFile.writeFile(filePath, codeGovReleases, error => {
        if (error) {
          logger.error(error)
        }
      })
    })
    .catch(error => {
      logger.error(`Error fetching releases.json from: ${fileUrl}`)
      throw error
    })
}

function delay (delayTime, passThroughValue) {
  return new Promise(resolve => {
    setTimeout(resolve.bind(null, passThroughValue), delayTime)
  })
}

module.exports = {
  writeOutData,
  cloneRepo,
  setInventoryStats,
  getLogger,
  getGithubStatsFromList,
  cloneTopRepos,
  addToGithubList,
  getAppVersion,
  getCodeGovReleasesFile,
  delay
}
