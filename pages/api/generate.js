import { Configuration, OpenAIApi } from "openai";
const sdk = require('api')('@control/v2022-07-18#7xvueytb2xflflhue6n');
sdk.auth('aabf265080c92953ab0c19d7be5d56ae09a4');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function (req, res) {
  if (!configuration.apiKey) {
    res.status(500).json({
      error: {
        message: "OpenAI API key not configured, please follow instructions in README.md",
      }
    });
    return;
  }

  const request = req.body.animal || '';
  if (request.trim().length === 0) {
    res.status(400).json({
      error: {
        message: "Please enter a valid request",
      }
    });
    return;
  }

  try {
    const data = await sdk.getPlans();
    // console.log(typeof data.data.data)
    const content = generatePrompt(request, data.data.data);
    console.log(`Request: ${request}`);
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{
        role: 'user',
        content: content,
        name: 'anon',
      }],
      temperature: 0.6,
    });
    console.log(completion.data.choices[0].message.content)
    const response = JSON.parse(completion.data.choices[0].message.content);
    if (!response.plan) {
      console.log(`Denied the following request: ${animal}`);
      res.status(200).json(completion.data.choices[0].message);
    } else if (response.plan_options) {
      console.log(`Suggested the following plans: ${response.plan_options.map(plan => plan.attributes.plan).join(', ')}`);
      res.status(200).json(completion.data.choices[0].message);
    } else if (response.plan) {
      console.log(`Selected the following plan: ${response.plan.attributes.plan}`)
      const createServerResponse = await sdk.createServer({
        data: response.plan
      });
      console.log(`Created the following server: ${createServerResponse.data.data.attributes.hostname}`);
      res.status(200).json(response.data.choices[0].message);
    }
  } catch (error) {
    console.error(JSON.stringify(error.data));
    // Consider adjusting the error handling logic for your use case
    if (error.response) {
      console.error(error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
      res.status(500).json({
        error: {
          message: 'An error occurred during your request.',
        }
      });
    }
  }
}

function generatePrompt(request, data) {
  return `Considering following available plans for virtual machines:

${data.slice(0, 10).map(generatePlans).join('\n')}

Reply to  following input from user in json format ready to be parsed by JSON.parse function:
input: ${request}

if they asked for anything other than creating a virtual machine deny with a creative funny message and tell them what you do in following json format:
{
  role: 'bot',
  message: 'produced message'
}

when ordering virtual machine one of above plans must be specificed
if they specified plan generate a superhero hostname, fill into below json and reply:
{
  'role': 'bot', 
  'plan': {
    'type': 'servers',
    'attributes': {
      'project': 'baxus-dev',
      'site': select plan site,
      'operating_system': 'ubuntu_22_04_x64_lts',
      'plan': the plan name they selected,
      'hostname': the superhero hostname
    }
  }
}`;
}

function generatePlans(data) {
  const planData = data.attributes || {};

  const name = planData.name || 'Unnamed plan';
  const specs = planData.specs || {};
  const available_in = planData.available_in || [];
  const cpus = specs.cpus || [];
  const memory = specs.memory?.total || 'N/A';
  const drives = specs.drives || [];
  const nics = specs.nics || [];
  const gpus = specs.gpu || [];

  const cpuDetails = cpus
    .map(cpu => `${cpu.count}x ${cpu.type} ${cpu.cores} cores ${cpu.clock}GHz`)
    .join(', ');
  const driveDetails = drives
    .map(drive => `${drive.count}x ${drive.size} ${drive.type}`)
    .join(', ');
  const nicDetails = nics.map(nic => `${nic.count}x ${nic.type}`).join(', ');
  const gpuDetails = gpus.map(gpu => `${gpu.count}x ${gpu.type}`).join(', ');

  const availablility = available_in.map(availablity => availablity.sites.map(site => site.in_stock ? site.slug : null).filter(availablity => availablity)).filter(availablity => availablity.length > 0).join(',');

  const description = `Name: ${name}: CPUs - (${cpuDetails}), Memory - ${memory} GB, Drives - (${driveDetails}), Available Sites - (${availablility})`;
  // const description = `Name: ${name}: CPUs - (${cpuDetails}), Memory - ${memory} GB, Drives - (${driveDetails}), NICs - (${nicDetails}), GPUs - (${gpuDetails})`;
  console.log(description);

  return `\n${description}`;
}