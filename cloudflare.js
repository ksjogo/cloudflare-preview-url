import core from '@actions/core'
import axios from 'axios'

export default async function getDeploymentUrl(
  token,
  accountId,
  accountEmail,
  projectId,
  repo,
  branch,
  environment,
  commitHash,
  skipSourceCheck
) {
  const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectId}/deployments`

  if (commitHash) {
    core.info(`Fetching ${commitHash} from: ${apiUrl}`)
  } else {
    core.info(`Fetching from: ${apiUrl}`)
  }

  const headers = accountEmail
    ? {
        'X-Auth-Key': token,
        'X-Auth-Email': accountEmail
      }
    : {
        Authorization: `Bearer ${token}`
      }

  const { data } = await axios.get(apiUrl, {
    headers,
    responseType: 'json',
    responseEncoding: 'utf8'
  })

  if (!data || !data.result || data.result.length <= 0) {
    core.error(JSON.stringify(data))
    throw new Error('no deployments found')
  }

  core.info(`Found ${data.result.length} deployments`)
  core.debug(`Looking for matching deployments ${repo}/${branch}`)

  let builds = data.result.filter(
    (d) =>
      skipSourceCheck ||
      (d && d.source && d.source.config && d.source.config.repo_name === repo)
  )
  core.debug(`${builds.length} after source`)

  builds = builds.filter(
    (d) =>
      d &&
      d.deployment_trigger &&
      d.deployment_trigger.metadata.branch === branch
  )
  core.debug(`${builds.length} after branch`)

  builds = builds.filter((d) => {
    if (environment && environment.length > 0) {
      return d.environment === environment
    } else {
      return true
    }
  })
  core.debug(`${builds.length} after environment`)

  builds = builds.filter(
    (d) =>
      commitHash === null ||
      (d.deployment_trigger.metadata !== null &&
        d.deployment_trigger.metadata.commit_hash === commitHash)
  )
  core.debug(`${builds.length} after commithash`)

  core.info(`Found ${builds.length} matching builds`)
  if (!builds || builds.length <= 0) {
    core.error(JSON.stringify(builds))
    throw new Error('no matching builds found')
  }

  const build = builds[0]
  core.info(
    `Preview URL: ${build.url} (${build.latest_stage.name} - ${build.latest_stage.status})`
  )

  return build
}
