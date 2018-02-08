const Octokit = require('@octokit/rest')
const JsonFile = require('jsonfile')
const path = require('path')
const winston = require('winston')
const { spawn } = require('child_process')

function parseGithubUrl (githubUrl) {

  if(githubUrl.match(/\/$/)) {
    githubUrl = githubUrl.replace(/\/$/, '')
  }
  if(githubUrl.match(/\.git$/)) {
    githubUrl = githubUrl.replace(/\.git$/, '')
  }
  const githubOwnerAndRepo = githubUrl.split('/').slice(-2)
  return {
    owner: githubOwnerAndRepo[0],
    repo: githubOwnerAndRepo[1]
  }
}

function isGithubUrl (repoUrl) {
  const githubUrlRegEx = /github.com/
  if (repoUrl) {
    const match = repoUrl.match(githubUrlRegEx)

    if (match) {
      return true
    }
  }

  return false
}

function getGithubClient (token) {
  const client = Octokit()
  client.authenticate({
    type: 'token',
    token: token
  })

  return client
}

function setInventoryStats(usageType, repositoryUrl, stats){
  if (usageType === 'openSource') {
    stats.totalOpenSourceProjects = stats.hasOwnProperty('totalOpenSourceProjects') ?
      stats.totalOpenSourceProjects + 1 : 0
  }
  if (usageType === 'governmentWideReuse') {
    stats.totalGovernmentWideReuse = stats.hasOwnProperty('totalGovernmentWideReuse') ?
      stats.totalGovernmentWideReuse + 1 : 0
  }
  if (usageType === 'exemptByLaw') {
    stats.totalExemptByLaw = stats.hasOwnProperty('totalExemptByLaw') ?
      stats.totalExemptByLaw + 1 : 0
  }
  if (usageType === 'exemptByNationalSecurity') {
    stats.totalExemptByNationalSecurity = stats.hasOwnProperty('totalExemptByNationalSecurity') ?
      stats.totalExemptByNationalSecurity + 1 : 0
  }
  if (usageType === 'exemptByAgencySystem') {
    stats.totalExemptByAgencySystem = stats.hasOwnProperty('totalExemptByAgencySystem') ?
      stats.totalExemptByAgencySystem + 1 : 0
  }
  if (usageType === 'exemptByAgencyMission') {
    stats.totalExemptByAgencyMission = stats.hasOwnProperty('totalExemptByAgencyMission') ?
      stats.totalExemptByAgencyMission + 1 : 0
  }
  if (usageType === 'exemptByCIO') {
    stats.totalExemptByCIO = stats.hasOwnProperty('totalExemptByCIO') ?
      stats.totalExemptByCIO + 1 : 0
  }
  if (usageType === 'exemptByPolicyDate') {
    stats.totalExemptByPolicyDate = stats.hasOwnProperty('totalExemptByPolicyDate') ?
      stats.totalExemptByPolicyDate + 1 : 0
  }
  if (repositoryUrl) {
    if (isGithubUrl(repositoryUrl)) {
      stats.totalProjectsGithub = stats.hasOwnProperty('totalProjectsGithub') ?
        stats.totalProjectsGithub + 1 : 0
    } else {
      stats.totalProjectsOtherVcsService = stats.hasOwnProperty('totalProjectsOtherVcsService') ?
        stats.totalProjectsOtherVcsService + 1 : 0
    }
  } else {
    stats.totalProjectsNoRepoUrl = stats.hasOwnProperty('totalProjectsNoRepoUrl') ?
      stats.totalProjectsNoRepoUrl + 1 : 0
  }
}

function addToGithubList(usageType, repositoryUrl, githubRepos) {
  if (usageType === 'openSource' && isGithubUrl(repositoryUrl)) {
    githubRepos.push(repositoryUrl)
  }
}

function getInventoryData (repo, repoUrls=null) {
  
  let githubRepos = []
  let filteredRepos = 

  repos.forEach(repo => {
    setInventoryStats(repo.permissions.usageType, repo.repositoryURL, stats)
    addToGithubList(repo, githubRepos)
  })

  return { stats, githubRepos }
}

async function getGithubData(repoUrl, githubClient) {
  const {owner, repo} = parseGithubUrl(repoUrl)
  let githubData
  let ownerData

  try {
    githubData = await githubClient.repos.get({owner, repo})
  } catch(error) {
    throw new Error(`[ ERROR ] Github repo data: ${repo}`, error.message)
  }
  
  try {
    ownerData = await githubClient.users.getForUser({username: owner})
  } catch(error) {
    throw new Error(`[ ERROR ] Github owner data: ${owner}`, error)
  }

  let orgInfo = {}
  if(githubData.data.organization) {
    orgInfo = {
      login: githubData.data.organization.login,
      id: githubData.data.organization.id,
      url: githubData.data.organization.organizations_url
    }
  }

  return {
    name: githubData.data.name || '',
    full_name: githubData.data.full_name || '',
    is_a_fork: githubData.data.fork || 0,
    stars: githubData.data.stargazers_count || 0,
    forks: githubData.data.forks_count || 0,
    watchers: githubData.data.subscribers_count || 0,
    owner_email: ownerData.data.email || '',
    created_at: githubData.data.created_at,
    org: orgInfo || {}
  }
}

function writeOutData (data, filename) {
  JsonFile.writeFile(path.join(path.dirname(__dirname), `/data/${filename}`), data, { spaces: 2, encoding: 'utf8' },
    (error) => {
      if (error) {
        throw error
      }
    })
}

function cloneRepo(repoUrl) {
  const { owner, repo } = parseGithubUrl(repoUrl)
  const git = spawn( 'git', ['clone', repoUrl, path.join(path.dirname(__dirname), `/data/repos/${repo}`)])
  
  git.stdout.on('data', data => console.log(`stdout: ${data}`))
  git.stderr.on('error', data => console.error(`stderror: ${data}`))
  git.on('close', code => console.log(`closed with code: ${code}`))
}

function getLogger() {
  const customFormatter = (options) => {
    return options.timestamp() + ' ' +
      winston.config.colorize(options.level, options.level.toUpperCase()) + ' ' +
      (options.message ? options.message : '') +
      (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
  }
  return new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ 
        timestamp: () => Date.now(),
        formatter: customFormatter,
        level: 'info'
      }),
      new (winston.transports.File)({
        timestamp: () => Date.now(),
        formatter: customFormatter,
        filename: path.join(path.dirname(__dirname), 'code-gov-stats.log'),
        level: 'debug'
      })
    ]
  });
}
module.exports = {
  parseGithubUrl,
  isGithubUrl,
  getGithubClient,
  getInventoryData,
  getGithubData,
  writeOutData,
  cloneRepo,
  setInventoryStats,
  addToGithubList,
  getLogger
}
