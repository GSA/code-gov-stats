const { getGithubClient, getGithubData, addToGithubList, writeOutData, setInventoryStats, isGithubUrl, cloneRepo, getLogger } = require('./libs/utils')
const dotenv = require('dotenv')
const jsonfile = require('jsonfile')

dotenv.config()

var logger = getLogger()
const topRepos = [
  {url: 'https://github.com/USArmyResearchLab/Dshell', folderName: 'Dshell'},
  {url: 'https://github.com/NationalSecurityAgency/SIMP', folderName: 'SIMP'},
  {url: 'https://github.com/iadgov/WALKOFF-Apps', folderName: 'WALKOFF-Apps'},
  {url: 'https://github.com/iadgov/WALKOFF', folderName: 'WALKOFF'},
  {url: 'https://github.com/nasa/openmct', folderName: 'openmct'},
  {url: 'https://github.com/SSAgov/ANDI', folderName: 'ANDI'},
  {url: 'https://github.com/LLNL/zfp', folderName: 'zfp'},
  {url: 'https://github.com/LLNL/spack', folderName: 'spack'},
  {url: 'https://github.com/adlnet/xAPI-Spec', folderName: 'xAPI-Spec'},
  {url: 'https://svn.code.sf.net/p/brlcad/code/brlcad/trunk', folderName: 'brlcad'},
  {url: 'https://github.com/uswds/uswds', folderName: 'uswds'}
]

function getInventoryStats () {
  logger.info('Starting Main.')

  const codeGovReleases = jsonfile.readFileSync('./releases.json')
  const githubClient = getGithubClient(process.env.GITHUB_TOKEN)

  let stats = { totalProjects: Object.keys(codeGovReleases.releases).length }
  let repoUrls = []
  let githubData = []

  logger.info('Starting releases iterator')
  Object.keys(codeGovReleases.releases).forEach(key => {
    const repo = codeGovReleases.releases[key]

    setInventoryStats(repo.permissions.usageType, repo.repositoryURL, stats)
    addToGithubList(repo.permissions.usageType, repo.repositoryURL, repoUrls)
  })
  logger.info('Finished releases iterator')

  logger.info('Writing out stats file.')
  logger.debug(`Stats: ${stats}`)
  writeOutData(stats, 'stats.json')
  stats = null

  logger.info('Get Github data start.')
  Promise.all(
    repoUrls.map(repoUrl => {
      return getGithubData(repoUrl, githubClient)
    })
  ).then(values => {
    logger.info('Writing out Github data.')
    writeOutData(values, 'github-data-all-inventory.json')
  })
  .catch(error => logger.error(error))
}

function getTopRepoStats (topRepos) {
  const githubClient = getGithubClient(process.env.GITHUB_TOKEN)
  Promise.all(
    topRepos.map(repo => {
      if (isGithubUrl(repo.url)) {
        return getGithubData(repo.url, githubClient)
      }
    })
  ).then(values => {
    logger.info('Writing out Github data.')
    writeOutData(values, 'github-data-top-repos.json')
  })
}

function cloneTopRepos(topRepos) {
  topRepos.forEach(repo => {
    cloneRepo(repo.url)
  })
}

getInventoryStats()
getTopRepoStats(topRepos)
cloneTopRepos(topRepos)
