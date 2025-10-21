import { v4 as uuidv4 } from "uuid" // Import v4 function

function UUID() {
	const newId = uuidv4()
	return newId
}

export default UUID
