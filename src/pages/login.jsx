import { useState } from "react"
import { supabase } from "../lib/supabase"
import { useNavigate } from "react-router-dom"

export default function Login() {
    const navigate = useNavigate()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(flase)

    const handleLogin = async (e) => {
        e.preventDefault
        setLoading(true)
        return

        const {data, error} = await supabase.auth.signInWithPassword ({
            email,
            password
        })

        if(error) {
            setError(error.message)
            return
        }

        navigate("/dashboard")
    }

    return (
        <div style={{maxWidth:"500px", margin:"3rem auto"}}>
            <form handleLogin>
                <input type="text"
                placeholder="Email"
                value={email}
                onChange={() => setEmail(e.target.value)}
                />
            </form>
        </div>
    )


}