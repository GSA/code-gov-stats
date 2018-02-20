const {
  setInventoryStats,
  addToGithubList,
  getLogger,
  getGithubStatsFromList,
  cloneTopRepos,
  writeOutData,
  getAppVersion
} = require('./libs/utils')
const { getGithubReposDataByOwner, getUniqueGithubRepoOwners } = require('./libs/github-utils')

const path = require('path')
const dotenv = require('dotenv')
const JsonFile = require('jsonfile')
const app = require('commander')

dotenv.config()

const usageText = `code-gov-stats <cmd>
  Commands:
    
    inventory-stats [releasesFile]   Calculate stats for all repositories in the Code.gov inventory.
                                     Uses the passed releases file path.
                                     Defaults to releases.json and tries to find it in the current directory
    top-stats                        Calculate stats for our top repositories. Uses top-repos.json file found in the apps config folder.
`
function getInventoryStats (releasesFile, logger) {
  logger.info('Starting to calculate Inventory Stats')
  const codeGovReleases = JsonFile.readFileSync(releasesFile)
  const releasesKeys = Object.keys(codeGovReleases.releases)

  let stats = {
    totalProjects: releasesKeys.length
  }
  let repoUrls = []

  releasesKeys.forEach(key => {
    const repo = codeGovReleases.releases[key]
    setInventoryStats({ usageType: repo.permissions.usageType, repositoryUrl: repo.repositoryURL, stats, logger })
    addToGithubList({ usageType: repo.permissions.usageType, repositoryUrl: repo.repositoryURL, githubRepos: repoUrls })
  })

  logger.info('Writing out stats file.')
  logger.debug(`Stats: ${stats}`)
  writeOutData(stats, 'stats.json')

  const uniqueRepoOwners = getUniqueGithubRepoOwners(repoUrls)

  getGithubReposDataByOwner({ repoOwnerList: uniqueRepoOwners, logger })
    .then(values => {
      writeOutData(values, 'inventory-github-data.json')
      logger.info('Finished calculating Inventory Stats')
    })
}

function getTopRepoStats (clone, logger) {
  const filePath = path.join(__dirname, '/config/top-repos.json')
  JsonFile.readFile(filePath, (error, topRepos) => {
    logger.info('Starting to calculate Top Repos Stats')

    if (error) {
      logger.error(error)
    }

    const repoUrls = topRepos.map(repo => repo.url)

    getGithubStatsFromList(repoUrls, logger)
      .then(values => {
        logger.info('Writing out Top Repo Github data.')
        writeOutData(values, 'github-data-top-repos.json')
        logger.info('Finished calculating Top Repos Stats')
      })

    if (clone) {
      logger.info('Cloning Top Repos')
      cloneTopRepos(topRepos)
      logger.info('Finished cloning Top Repos')
    }
  })
}

app.version(getAppVersion())
  .usage(usageText)

app.command('inventory-stats [releasesFile]')
  .action(releasesFile => {
    releasesFile = releasesFile || path.join(__dirname, 'releases.json')
    getInventoryStats(releasesFile, getLogger())
  })

app.command('top-stats')
  .option('-c, --clone', 'Clone repositories from remote.')
  .action((command) => {
    getTopRepoStats(command.clone, getLogger())
  })

app.parse(process.argv)
