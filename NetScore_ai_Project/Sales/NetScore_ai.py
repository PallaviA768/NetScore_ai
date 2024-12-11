from flask import Flask, request, render_template, jsonify, redirect, url_for, session
import os
import openai
import pandas as pd
import numpy as np

# Initialize the Flask app
app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Required for session management

# Variables to store file path and API key dynamically
file_path = None
OPENAI_API_KEY = None
df = None

@app.route('/config', methods=['GET', 'POST'])
def config():
    global file_path, OPENAI_API_KEY, df

    if request.method == 'POST':
        file_path = request.form.get('file_path', '').strip()
        OPENAI_API_KEY = request.form.get('api_key', '').strip()

        # Validate file type
        if not file_path.endswith('.csv'):
            return render_template('config.html', error="Only .csv files are acceptable.")

        # Validate OpenAI API key format (basic check for non-empty and length)
        if not OPENAI_API_KEY or len(OPENAI_API_KEY) < 20:
            return render_template('config.html', error="Invalid OpenAI API key. Please provide a valid key.")

        # Save the API key
        openai.api_key = OPENAI_API_KEY

        try:
            # Load the data from the given file path
            df = pd.read_csv(file_path)

            # Identify date columns automatically
            potential_date_columns = [col for col in df.columns if 'date' in col.lower()]
            for col in potential_date_columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')

            column_info = {col: str(dtype) for col, dtype in zip(df.columns, df.dtypes)}
            session['column_info'] = column_info  # Store column info in the session

            return redirect(url_for('home'))  # Redirect to the chatbot page
        except Exception as e:
            return render_template('config.html', error=f"Error loading file: {e}")

    return render_template('config.html')


@app.route('/', methods=['GET', 'POST'])
def home():
    global df
    if not file_path or not OPENAI_API_KEY:
        return redirect(url_for('config'))  # Redirect to configuration if not set

    if request.method == 'POST':
        user_input = request.json.get('question', '').strip()
        if not user_input:
            return jsonify({"error": "No question provided."}), 400

        response = generate_gpt_response(user_input)
        if isinstance(response, dict) and "error" in response:
            return jsonify(response), 400

        return jsonify({"result": response})

    return render_template('index.html')

def generate_gpt_response(question):
    global df
    column_info = session.get('column_info', {})
    sales_keywords = ["sales", "revenue", "order", "customer", "amount", "quantity", "transaction"]

    if not question:
        return {"error": "Please provide a question to get a response."}

    # Check if the question is sales-related
    if not any(keyword in question.lower() for keyword in sales_keywords):
        return "Content is not related."

    # Construct the prompt for OpenAI
    prompt = f"""
    You are a data query assistant. You have the following DataFrame fields and data types:
    {column_info}

    Ensure that columns such as ['Date', 'Ship Date', 'any_other_date_column'] are converted to datetime using `pd.to_datetime()`.

    The user has input the following query:
    "{question}"

    Return only a valid pandas DataFrame query, such as `df[...]` or `df['column'].sum()`, without any additional text or explanations.
    """

    try:
        # Query OpenAI
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100
        )
        generated_query = response.choices[0].message['content'].strip()
        print("Generated Query:", generated_query)

        if not generated_query.startswith("df"):
            print("Invalid query format received from OpenAI.")
            return {"error": "Invalid query format received from OpenAI."}

        # Safely execute the query
        local_vars = {"df": df, "pd": pd, "np": np}
        result = eval(generated_query, {"__builtins__": None}, local_vars)

        print("Executed Query Result:", result, "Type:", type(result))

        # Handle different result types
        if isinstance(result, pd.DataFrame):
            # Format monetary columns in the DataFrame
            for col in result.columns:
                if 'amount' in col.lower() or 'price' in col.lower():
                    result[col] = result[col].apply(lambda x: f"₹{x:,.2f}" if pd.notnull(x) else x)
            html_table = result.to_html(classes='table table-bordered')
            return html_table
        elif isinstance(result, pd.Series):
            # Convert Series to DataFrame and format
            if 'amount' in result.name.lower() or 'price' in result.name.lower():
                result = result.apply(lambda x: f"₹{x:,.2f}" if pd.notnull(x) else x)
            result = result.to_frame()
            html_table = result.to_html(classes='table table-bordered')
            return html_table
        elif np.isscalar(result):
            # Format scalar values
            if isinstance(result, (float, int)):
                return f"₹{result:,.2f}"
            return str(result)
        else:
            return str(result)

    except Exception as e:
        print(f"Error: {e}")
        return {"error": f"Error: {e}"}




if __name__ == '__main__':
    app.run(debug=True)
