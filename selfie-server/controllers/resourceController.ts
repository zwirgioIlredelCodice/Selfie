import Resource from "../models/Resource";

const formatResource = (resource: any) => {
    return {
        id: resource._id,
        name: resource.name,
        username: resource.username
    };
}

// Function to get all resources
export const getAllResources = async (req: any, res: any) => {
    try {
        const resources = await Resource.find();
        const formattedResources = resources.map((resource: any) => formatResource(resource));
        res.status(200).send(formattedResources);
    } catch (error) {
        res.status(500).send({ error: 'Error retrieving resources' });
    }
}

// Function to add a new resource
export const addResource = async (req: any, res: any) => {
    const newResource = new Resource({
        name: req.body.name,
        username: req.body.username
    });

    try {
        await newResource.save();
        res.status(201).send(formatResource(newResource));
    } catch (error) {
        res.status(400).send({ error: 'Error creating resource' });
    }
}

// Function to delete a resource by ID
export const deleteResource = async (req: any, res: any) => {
    const { id } = req.params;
    try {
        await Resource.findByIdAndDelete(id);
        res.status(204).send();
    } catch (error) {
        res.status(404).send({ error: "Resource doesn't exist!" });
    }
}